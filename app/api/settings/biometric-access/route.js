import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

// Save a gym's expired-member access rules: how long after expiry the gate
// still opens, and whether blocking revokes access or removes the user record.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const writeBlocked = await blockViewOnlyWrites(request, supabase, user.id);
  if (writeBlocked) return writeBlocked;

  let days = Number(body?.biometric_grace_days);
  if (!Number.isFinite(days)) {
    return NextResponse.json({ error: "Invalid buffer days" }, { status: 400 });
  }
  days = Math.min(90, Math.max(0, Math.round(days)));

  const mode = body?.biometric_block_mode === "delete" ? "delete" : "disable";

  const { error } = await supabase
    .from("gyms")
    .update({ biometric_grace_days: days, biometric_block_mode: mode })
    .eq("id", gymId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    data: { graceDays: days, blockMode: mode },
  });
});
