import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

// The gym comes from the caller's own profile, never the request body, so one
// gym's staff cannot read another gym's trainers.
export const POST = withAuth(async (request, { gymId, supabase }) => {
  const { data, error } = await supabase.rpc("get_trainers_list", {
    p_gym_id: gymId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
