import { NextResponse } from "next/server";
import { executeTrainerAssign } from "@/lib/server/trainerAssignmentApiLogic";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await executeTrainerAssign(body);
    return NextResponse.json({ data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error("POST /api/trainer/assign:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status });
  }
}
