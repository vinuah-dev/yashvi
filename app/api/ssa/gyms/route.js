import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";

// Verify SSA token
function verifySsaToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, token } = body;

    const ssa = verifySsaToken(token);
    if (!ssa) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // ─── LIST ALL GYMS WITH OWNER + STATS ──────────────────
    if (action === "list_gyms") {
      // Get all gyms with owner info
      const { data: gyms, error } = await supabase
        .from("gyms")
        .select(`
          id, name, address, created_at,
          profiles!gyms_owner_id_fkey (
            id, first_name, last_name, email, phone
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get member counts per gym
      const { data: memberCounts } = await supabase
        .from("members")
        .select("gym_id");

      const countMap = {};
      (memberCounts || []).forEach((m) => {
        countMap[m.gym_id] = (countMap[m.gym_id] || 0) + 1;
      });

      // Get feature access for all gyms
      const { data: featureAccess } = await supabase
        .from("gym_feature_access")
        .select("gym_id, module_id, is_enabled");

      const accessMap = {};
      (featureAccess || []).forEach((f) => {
        if (!accessMap[f.gym_id]) accessMap[f.gym_id] = {};
        accessMap[f.gym_id][f.module_id] = f.is_enabled;
      });

      const result = (gyms || []).map((g) => ({
        ...g,
        member_count: countMap[g.id] || 0,
        feature_access: accessMap[g.id] || {},
      }));

      return NextResponse.json({ data: result });
    }

    // ─── GET ALL FEATURE MODULES ────────────────────────────
    if (action === "list_modules") {
      const { data, error } = await supabase
        .from("feature_modules")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return NextResponse.json({ data });
    }

    // ─── TOGGLE A FEATURE FOR A GYM ────────────────────────
    if (action === "toggle_feature") {
      const { gym_id, module_id, is_enabled, notes } = body;

      const { data: existing } = await supabase
        .from("gym_feature_access")
        .select("id")
        .eq("gym_id", gym_id)
        .eq("module_id", module_id)
        .single();

      let result;
      if (existing) {
        result = await supabase
          .from("gym_feature_access")
          .update({
            is_enabled,
            notes: notes || null,
            enabled_at: is_enabled ? new Date().toISOString() : null,
            disabled_at: !is_enabled ? new Date().toISOString() : null,
          })
          .eq("id", existing.id);
      } else {
        result = await supabase
          .from("gym_feature_access")
          .insert({
            gym_id,
            module_id,
            is_enabled,
            notes: notes || null,
            enabled_at: is_enabled ? new Date().toISOString() : null,
            disabled_at: !is_enabled ? new Date().toISOString() : null,
          });
      }

      if (result.error) throw result.error;
      return NextResponse.json({ success: true });
    }

    // ─── BULK SET ALL FEATURES FOR A GYM ───────────────────
    if (action === "bulk_set_features") {
      const { gym_id, modules } = body;
      // modules = { module_id: true/false, ... }

      for (const [module_id, is_enabled] of Object.entries(modules)) {
        const { data: existing } = await supabase
          .from("gym_feature_access")
          .select("id")
          .eq("gym_id", gym_id)
          .eq("module_id", module_id)
          .single();

        if (existing) {
          await supabase
            .from("gym_feature_access")
            .update({ is_enabled })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("gym_feature_access")
            .insert({ gym_id, module_id, is_enabled });
        }
      }

      return NextResponse.json({ success: true });
    }

    // ─── GET FEATURE ACCESS FOR ONE GYM ────────────────────
    if (action === "get_gym_features") {
      const { gym_id } = body;
      const { data, error } = await supabase
        .from("gym_feature_access")
        .select("module_id, is_enabled, notes, enabled_at, disabled_at")
        .eq("gym_id", gym_id);
      if (error) throw error;
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
