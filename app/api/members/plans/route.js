import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

// GET, so the caller identifies itself with x-user-id (and x-gym-id when an
// owner is working on a gym other than their own default).
export const GET = withAuth(async (request, { gymId, supabase }) => {
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
