import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, body }) => {
  const { p_period_start, p_period_end, p_business_tz } = body;

  if (!p_period_start || !p_period_end) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_finance_data", {
    p_gym_id: gymId,
    p_period_start,
    p_period_end,
    p_business_tz: p_business_tz || "Asia/Kolkata",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
