import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, user, body }) => {
  const action = body?.action;

  // ─── Process referral ──────────────────────────────────
  if (action === "process") {
    const { data, error } = await supabase.rpc("process_referral", {
      p_gym_id: gymId,
      p_new_member_id: body.new_member_id,
      p_referrer_id: body.referrer_id,
      p_changed_by: user?.id || null,
      p_changed_by_name: user?.name || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ data });
  }

  // ─── Validate referral code (check if member exists) ───
  if (action === "validate") {
    const { data, error } = await supabase
      .from("members")
      .select("id, full_name")
      .eq("id", body.referral_code)
      .eq("gym_id", gymId)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ valid: false });
    return NextResponse.json({ valid: true, referrer_name: data.full_name });
  }

  // ─── Get referral settings ─────────────────────────────
  if (action === "get_settings") {
    const { data } = await supabase
      .from("referral_settings")
      .select("*")
      .eq("gym_id", gymId)
      .maybeSingle();
    return NextResponse.json({ data: data || { points_per_referral: 50, points_to_currency_ratio: 1.0, is_active: true } });
  }

  // ─── Update referral settings ──────────────────────────
  if (action === "update_settings") {
    const { error } = await supabase
      .from("referral_settings")
      .upsert({
        gym_id: gymId,
        points_per_referral: body.points_per_referral,
        points_to_currency_ratio: body.points_to_currency_ratio,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      }, { onConflict: "gym_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, { allowBodyUserId: true });
