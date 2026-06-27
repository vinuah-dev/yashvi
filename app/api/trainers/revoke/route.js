import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const writeBlocked = await blockViewOnlyWrites(request, supabaseAdmin);
    if (writeBlocked) return writeBlocked;

    const { trainerProfileId } = await request.json();

    if (!trainerProfileId) {
      return NextResponse.json({ error: "trainerProfileId is required" }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { error } = await supabase.auth.admin.updateUserById(trainerProfileId, {
      ban_duration: "8760h",
    });

    if (error) {
      if (error.status === 404 || error.code === "user_not_found") {
        return NextResponse.json({ success: true, skipped: true });
      }
      console.error("Failed to revoke trainer sessions", error);
      return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error revoking trainer sessions", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
