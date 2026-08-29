import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { blockMemberOnDevices } from "@/lib/server/biometricCommands";

/**
 * GET /api/biometric/sweep
 *
 * Withdraws device access from every member whose buffer period has run out.
 *
 * The ADMS server also blocks expired members, but only when one of them
 * punches — and by then the scanner has already matched the finger locally and
 * opened the gate. So on its own that path always lets one more entry through,
 * and lets an unlimited number through if the member simply stops punching and
 * walks in behind someone else.
 *
 * This sweep closes that hole by blocking on a schedule instead of on a punch.
 * Meant to run daily from the Vercel cron (see vercel.json).
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseServer();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: gyms, error: gymErr } = await supabase
      .from("gyms")
      .select("id, name, biometric_grace_days");

    if (gymErr) throw gymErr;

    const summary = [];

    for (const gym of gyms || []) {
      const graceRaw = Number(gym.biometric_grace_days);
      const graceDays = Number.isFinite(graceRaw) && graceRaw >= 0 ? graceRaw : 7;

      // Only members who can actually open a gate and aren't already blocked.
      const { data: members, error: memErr } = await supabase
        .from("members")
        .select("id, full_name, biometric_uid, biometric_blocked")
        .eq("gym_id", gym.id)
        .eq("biometric_blocked", false)
        .not("biometric_uid", "is", null);

      if (memErr || !members || members.length === 0) continue;

      // One query for every candidate's memberships rather than one per
      // member — a gym can have thousands.
      const { data: memberships } = await supabase
        .from("memberships")
        .select("member_id, status, end_date")
        .in(
          "member_id",
          members.map((m) => m.id),
        );

      // Keep only the furthest end_date per member; that's the one that
      // decides whether they still have access.
      const latest = new Map();
      for (const ms of memberships || []) {
        const prev = latest.get(ms.member_id);
        if (!prev || (ms.end_date || "") > (prev.end_date || "")) {
          latest.set(ms.member_id, ms);
        }
      }

      let blocked = 0;
      let noBackup = 0;
      let skippedNoMembership = 0;

      for (const member of members) {
        const ms = latest.get(member.id);

        // A member with no membership row at all is left alone. That is more
        // likely a half-finished signup than someone sneaking in, and
        // auto-blocking them would lock out a paying customer.
        if (!ms || !ms.end_date) {
          skippedNoMembership += 1;
          continue;
        }

        if (ms.status === "active" && ms.end_date >= today.toISOString().split("T")[0]) {
          continue;
        }

        const cutoff = new Date(ms.end_date);
        cutoff.setDate(cutoff.getDate() + graceDays);
        cutoff.setHours(0, 0, 0, 0);

        if (today <= cutoff) continue; // still inside the buffer

        const result = await blockMemberOnDevices(supabase, gym.id, member);
        if (result.reason === "blocked") {
          blocked += 1;
          if (!result.backedUp) noBackup += 1;
        }
      }

      if (blocked > 0 || skippedNoMembership > 0) {
        summary.push({
          gym: gym.name,
          graceDays,
          blocked,
          // These members will need their finger enrolled again on renewal.
          withoutFingerprintBackup: noBackup,
          skippedNoMembership,
        });
      }
    }

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      gyms: summary,
      totalBlocked: summary.reduce((n, g) => n + g.blocked, 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Sweep failed" },
      { status: 500 },
    );
  }
}
