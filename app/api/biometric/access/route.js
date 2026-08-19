import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";
import {
  blockMemberOnDevices,
  unblockMemberOnDevices,
  queueCommandForGym,
  buildDeleteUserCommand,
} from "@/lib/server/biometricCommands";

// Controls whether a member's fingerprint can still open the gate.
//
// The F22 matches locally and opens the gate before the server hears about it,
// so access is changed by pushing a command to the device. By default that's a
// "disable" (the enrolled finger stays on the device), which means a renewal
// can switch access back on instantly instead of re-enrolling.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const action = body?.action;

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

  // ── Purge a fingerprint by raw UID (member deleted) ──
  if (action === "purge_uid") {
    const uid = String(body.biometric_uid || "").trim();
    if (!uid) return NextResponse.json({ error: "Missing biometric_uid" }, { status: 400 });

    const queued = await queueCommandForGym(supabase, gymId, buildDeleteUserCommand(uid));
    return NextResponse.json({ success: true, devices: queued });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});
