import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";

function verifySsaToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, token } = body;
    if (!verifySsaToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getSupabaseAdmin();

    // ── LIST ALL GYMS WITH OWNER + STATS ────────────────────
    if (action === "list_gyms") {
      const { data: gyms, error } = await supabase
        .from("gyms")
        .select(`id, name, address, created_at, is_active,
          profiles!gyms_owner_id_fkey (id, first_name, last_name, email, phone, password)`)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: members } = await supabase.from("members").select("gym_id");
      const countMap = {};
      (members || []).forEach(m => { countMap[m.gym_id] = (countMap[m.gym_id] || 0) + 1; });

      const { data: access } = await supabase.from("gym_feature_access").select("gym_id, module_id, is_enabled");
      const accessMap = {};
      (access || []).forEach(f => {
        if (!accessMap[f.gym_id]) accessMap[f.gym_id] = {};
        accessMap[f.gym_id][f.module_id] = f.is_enabled;
      });

      return NextResponse.json({
        data: (gyms || []).map(g => ({
          ...g,
          owner: g.profiles || null,
          member_count: countMap[g.id] || 0,
          feature_access: accessMap[g.id] || {},
        }))
      });
    }

    // ── ADD GYM + OWNER ─────────────────────────────────────
    if (action === "add_gym") {
      const { gym_name, gym_address, first_name, last_name, email, phone, password } = body;
      if (!gym_name || !first_name || !email || !password)
        return NextResponse.json({ error: "gym_name, first_name, email, password required" }, { status: 400 });

      const { data: existing } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase().trim()).maybeSingle();
      if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

      const { data: profile, error: pErr } = await supabase.from("profiles").insert({
        first_name: first_name.trim(), last_name: last_name?.trim() || "",
        email: email.toLowerCase().trim(), phone: phone?.trim() || null,
        password, role: "owner",
      }).select().single();
      if (pErr) throw pErr;

      const { data: gym, error: gErr } = await supabase.from("gyms").insert({
        name: gym_name.trim(), address: gym_address?.trim() || null, owner_id: profile.id,
      }).select().single();
      if (gErr) { await supabase.from("profiles").delete().eq("id", profile.id); throw gErr; }

      return NextResponse.json({ data: { profile, gym } });
    }

    // ── EDIT GYM + OWNER ────────────────────────────────────
    if (action === "edit_gym") {
      const { gym_id, gym_name, gym_address, owner_id, first_name, last_name, email, phone, password } = body;
      if (!gym_id) return NextResponse.json({ error: "gym_id required" }, { status: 400 });

      const gymUpdate = {};
      if (gym_name) gymUpdate.name = gym_name.trim();
      if (gym_address !== undefined) gymUpdate.address = gym_address?.trim() || null;
      if (Object.keys(gymUpdate).length > 0)
        await supabase.from("gyms").update(gymUpdate).eq("id", gym_id);

      if (owner_id) {
        const ownerUpdate = {};
        if (first_name) ownerUpdate.first_name = first_name.trim();
        if (last_name !== undefined) ownerUpdate.last_name = last_name.trim();
        if (email) ownerUpdate.email = email.toLowerCase().trim();
        if (phone !== undefined) ownerUpdate.phone = phone?.trim() || null;
        if (password) ownerUpdate.password = password;
        if (Object.keys(ownerUpdate).length > 0)
          await supabase.from("profiles").update(ownerUpdate).eq("id", owner_id);
      }
      return NextResponse.json({ success: true });
    }

    // ── TOGGLE GYM ACTIVE ────────────────────────────────────
    if (action === "toggle_gym") {
      const { gym_id, is_active } = body;
      if (!gym_id) return NextResponse.json({ error: "gym_id required" }, { status: 400 });
      const { error } = await supabase.from("gyms").update({ is_active }).eq("id", gym_id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── DELETE GYM ───────────────────────────────────────────
    if (action === "delete_gym") {
      const { gym_id, owner_id } = body;
      if (!gym_id) return NextResponse.json({ error: "gym_id required" }, { status: 400 });
      await supabase.from("gyms").delete().eq("id", gym_id);
      if (owner_id) await supabase.from("profiles").delete().eq("id", owner_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
