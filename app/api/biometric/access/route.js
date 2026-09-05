import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";
import {
  blockMemberOnDevices,
  unblockMemberOnDevices,
  blockUidOnDevices,
  restoreUidOnDevices,
  queueCommandForGym,
  buildDeleteUserCommand,
} from "@/lib/server/biometricCommands";

// Controls whether a member's or trainer's fingerprint still opens the gate.
//
// The F22 matches locally and opens the gate before the server hears about it,
// so access is changed by pushing a command to the device. Which command that
// is comes from the gym's block mode: by default the user is moved into the
// scanner's no-access group, which withholds entry while leaving the enrolled
// finger in place so a renewal is a single command.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const action = body?.action;

  // ── Read the gym's current access rules ──
  // The settings screen loads through here; without it the page silently fell
  // back to defaults and showed the wrong mode whatever was actually saved.
  if (action === "settings") {
    const { data: gym } = await supabase
      .from("gyms")
      .select("biometric_grace_days, biometric_block_mode")
      .eq("id", gymId)
      .maybeSingle();

    const days = Number(gym?.biometric_grace_days);

    return NextResponse.json({
      data: {
        graceDays: Number.isFinite(days) ? days : 7,
        blockMode: gym?.biometric_block_mode || "group",
      },
    });
  }

  const writeBlocked = await blockViewOnlyWrites(request, supabase, user.id);
  if (writeBlocked) return writeBlocked;

  const loadMember = async (memberId) => {
    const { data } = await supabase
      .from("members")
      .select("id, full_name, biometric_uid, biometric_blocked")
      .eq("id", memberId)
      .eq("gym_id", gymId)
      .maybeSingle();
    return data;
  };

  // ── Stop a member at the gate ──
  if (action === "block") {
    if (!body.member_id) {
      return NextResponse.json({ error: "Missing member_id" }, { status: 400 });
    }

    const member = await loadMember(body.member_id);
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!member.biometric_uid) {
      return NextResponse.json(
        { error: "This member has no Biometric User ID set." },
        { status: 400 },
      );
    }

    const result = await blockMemberOnDevices(supabase, gymId, member, { force: true });
    return NextResponse.json({
      success: true,
      devices: result.queued,
      backedUp: result.backedUp,
    });
  }

  // ── Let them back in (renewal / manual) ──
  if (action === "unblock") {
    if (!body.member_id) {
      return NextResponse.json({ error: "Missing member_id" }, { status: 400 });
    }

    const member = await loadMember(body.member_id);
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const result = await unblockMemberOnDevices(supabase, gymId, member);
    return NextResponse.json({
      success: true,
      queued: result.queued,
      fingers: result.fingers || 0,
      needsReEnroll: result.needsReEnroll,
    });
  }

  // ── Trainers ──
  // Trainers punch on the same scanner but their UID lives on profiles, and
  // they have no membership to expire — access is withdrawn when they are
  // deactivated or removed from the gym, not on a schedule.
  if (action === "block_trainer" || action === "unblock_trainer") {
    if (!body.profile_id) {
      return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });
    }

    // Without this a trainer at gym A could be pushed to gym B's devices.
    const { data: link } = await supabase
      .from("gym_trainers")
      .select("id")
      .eq("gym_id", gymId)
      .eq("profile_id", body.profile_id)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: "Trainer not found at this gym" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, biometric_uid")
      .eq("id", body.profile_id)
      .maybeSingle();

    const uid = profile?.biometric_uid;
    if (!uid) {
      return NextResponse.json(
        { error: "This trainer has no Biometric User ID set." },
        { status: 400 },
      );
    }

    const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();

    if (action === "block_trainer") {
      const result = await blockUidOnDevices(supabase, gymId, uid, name);
      return NextResponse.json({
        success: true,
        devices: result.queued,
        backedUp: result.backedUp,
      });
    }

    const result = await restoreUidOnDevices(supabase, gymId, uid, name);
    return NextResponse.json({
      success: true,
      queued: result.queued,
      fingers: result.fingers || 0,
      needsReEnroll: result.needsReEnroll,
    });
  }

  // ── Purge a fingerprint by raw UID (member or trainer removed) ──
  if (action === "purge_uid") {
    const uid = String(body.biometric_uid || "").trim();
    if (!uid) return NextResponse.json({ error: "Missing biometric_uid" }, { status: 400 });

    const queued = await queueCommandForGym(supabase, gymId, buildDeleteUserCommand(uid));
    return NextResponse.json({ success: true, devices: queued });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});
