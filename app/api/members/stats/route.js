import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/apiMiddleware";

export const POST = withApi(async (request, { supabase }) => {
  const { p_gym_id, p_user_id, p_is_trainer } = await request.json();

  if (!p_gym_id) {
    return NextResponse.json({ error: "Missing p_gym_id" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_members_stats", {
    p_gym_id,
    p_user_id: p_user_id || null,
    p_is_trainer: p_is_trainer || false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
