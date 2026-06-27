import { NextResponse } from "next/server";
import { executeTrainerRenew } from "@/lib/server/trainerAssignmentApiLogic";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await executeTrainerRenew(body);
    return NextResponse.json({ data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error("POST /api/trainer/renew:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status });
  }
}
