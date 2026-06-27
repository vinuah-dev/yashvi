import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase }) => {
  const { data, error } = await supabase.rpc("get_dashboard_data", {
    p_gym_id: gymId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}, { allowBodyUserId: true });
