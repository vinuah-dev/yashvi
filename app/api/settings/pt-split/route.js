import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

// Read / update the trainer's share of personal-training revenue for a gym.
// Stored on the gyms table (pt_trainer_share_percent). Defaults to 50 so the
// historical 50/50 split is preserved until an admin changes it.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const action = body?.action;

  if (action === "get") {
    const { data } = await supabase
      .from("gyms")
      .select("pt_trainer_share_percent")
      .eq("id", gymId)
      .maybeSingle();
    const pct = Number(data?.pt_trainer_share_percent);
    return NextResponse.json({
      data: { pt_trainer_share_percent: Number.isFinite(pct) ? pct : 50 },
    });
  }

  if (action === "update") {
    const writeBlocked = await blockViewOnlyWrites(request, supabase, user.id);
    if (writeBlocked) return writeBlocked;

    let pct = Number(body.pt_trainer_share_percent);
    if (!Number.isFinite(pct)) {
      return NextResponse.json({ error: "Invalid percentage" }, { status: 400 });
    }
    // Clamp to a sensible range.
    pct = Math.min(100, Math.max(0, Math.round(pct)));

    const { error } = await supabase
      .from("gyms")
      .update({ pt_trainer_share_percent: pct })
      .eq("id", gymId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { pt_trainer_share_percent: pct } });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});
