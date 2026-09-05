import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

// Gym is taken from the authenticated caller, not the body.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const { data, error } = await supabase.rpc("get_members_stats", {
    p_gym_id: gymId,
    // A trainer only sees their own members, so the filter is pinned to the
    // caller rather than trusting whatever id the client sent.
    p_user_id: user.role === "trainer" ? user.id : body?.p_user_id || null,
    p_is_trainer: user.role === "trainer" ? true : body?.p_is_trainer || false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
