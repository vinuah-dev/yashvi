import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, user, body }) => {
  const isAdmin = ["owner", "admin", "view_only"].includes(user?.role);
  const adminView = body?.admin_view === true && isAdmin;

  const rpcName = adminView
    ? "get_attendance_leaderboard_admin"
    : "get_attendance_leaderboard";

  const { data, error } = await supabase.rpc(rpcName, {
    p_gym_id: gymId,
    p_limit: adminView ? 100 : 50,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}, { allowBodyUserId: true });
