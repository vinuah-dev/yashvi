import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, user, body }) => {
  const action = body?.action;

  // ─── Update points ─────────────────────────────────────
  if (action === "update") {
    const { data, error } = await supabase.rpc("update_member_points", {
      p_gym_id: gymId,
      p_member_id: body.member_id,
      p_points_change: body.points_change,
      p_reason: body.reason || null,
      p_changed_by: user?.id || null,
      p_changed_by_name: user?.name || user?.first_name || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── Get history ───────────────────────────────────────
  if (action === "history") {
    const { data, error } = await supabase.rpc("get_member_points_history", {
      p_member_id: body.member_id,
      p_limit: body.limit || 20,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, { allowBodyUserId: true });
