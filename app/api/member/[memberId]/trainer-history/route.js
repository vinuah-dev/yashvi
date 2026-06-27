import { NextResponse } from "next/server";
import { fetchTrainerHistory } from "@/lib/server/trainerAssignmentApiLogic";
import { getRequestUserId } from "@/lib/server/tenantAuth";

export async function GET(request, context) {
  try {
    const params = await context.params;
    const memberId = params?.memberId;
    if (!memberId) {
      return NextResponse.json({ error: "Missing member id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const pUserId = searchParams.get("p_user_id") || getRequestUserId(request);
    if (!pUserId) {
      return NextResponse.json({ error: "Missing p_user_id or x-user-id header" }, { status: 401 });
    }

    const data = await fetchTrainerHistory(memberId, pUserId);
    return NextResponse.json({ data });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error("GET /api/member/[memberId]/trainer-history:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status });
  }
}
