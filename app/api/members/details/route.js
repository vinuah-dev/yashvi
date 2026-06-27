import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/apiMiddleware";

export const POST = withApi(async (request, { supabase }) => {
  const { p_member_id, p_gym_id } = await request.json();

  if (!p_member_id || !p_gym_id) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_member_details", {
    p_member_id,
    p_gym_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
