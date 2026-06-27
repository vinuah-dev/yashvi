import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/apiMiddleware";

export const POST = withApi(async (request, { supabase }) => {
  const { p_gym_id, p_trainer_id, p_month } = await request.json();

  if (!p_gym_id || !p_trainer_id) {
    return NextResponse.json(
      { error: "Missing p_gym_id or p_trainer_id" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("get_trainer_attendance_summary", {
    p_gym_id,
    p_trainer_id,
    p_month: p_month || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
