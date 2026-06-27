import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";

// GET /api/features?gym_id=xxx
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const gymId = searchParams.get("gym_id");

    if (!gymId) {
      return NextResponse.json({ error: "gym_id required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get all modules
    const { data: modules } = await supabase
      .from("feature_modules")
      .select("id")
      .eq("is_active", true);

    // Get disabled modules for this gym
    const { data: access } = await supabase
      .from("gym_feature_access")
      .select("module_id, is_enabled")
      .eq("gym_id", gymId);

    // Build a map: module_id → is_enabled
    // Default: all modules ENABLED unless explicitly disabled
    const disabledSet = new Set(
      (access || [])
        .filter((a) => a.is_enabled === false)
        .map((a) => a.module_id)
    );

    const result = {};
    (modules || []).forEach((m) => {
      result[m.id] = !disabledSet.has(m.id);
    });

    return NextResponse.json({ features: result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
