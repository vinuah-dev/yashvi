import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/apiMiddleware";

export const GET = withApi(async (request, { supabase }) => {
  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get("gym_id");

  if (!gymId) {
    return NextResponse.json({ error: "Missing gym_id" }, { status: 400 });
  }

  const { data: plans, error } = await supabase
    .from("membership_plans")
    .select("id, name, duration_days, price, is_active")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plans: plans || [] });
});
