import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

// Returns a member's full record including payments and dues, so the gym is
// taken from the authenticated caller rather than the request body.
export const POST = withAuth(async (request, { gymId, supabase, body }) => {
  const memberId = body?.p_member_id;

  if (!memberId) {
    return NextResponse.json({ error: "Missing p_member_id" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_member_details", {
    p_member_id: memberId,
    p_gym_id: gymId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
