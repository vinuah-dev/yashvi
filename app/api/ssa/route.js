import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";
import bcrypt from "bcryptjs";

const SSA_SESSION_KEY = "ssa_session";

// POST — login or verify or logout
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    const supabase = getSupabaseAdmin();

    // ─── LOGIN ──────────────────────────────────────────────
    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password required" }, { status: 400 });
      }

      const { data: ssa, error } = await supabase
        .from("super_super_admins")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .eq("is_active", true)
        .single();

      if (error || !ssa) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const valid = await bcrypt.compare(password, ssa.password_hash);
      if (!valid) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      // Update last login
      await supabase
        .from("super_super_admins")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", ssa.id);

      // Simple session token (id + timestamp signed together)
      const sessionToken = Buffer.from(JSON.stringify({
        id: ssa.id,
        email: ssa.email,
        name: ssa.name,
        exp: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      })).toString("base64");

      return NextResponse.json({
        success: true,
        token: sessionToken,
        ssa: { id: ssa.id, email: ssa.email, name: ssa.name },
      });
    }

    // ─── VERIFY TOKEN ───────────────────────────────────────
    if (action === "verify") {
      const { token } = body;
      if (!token) return NextResponse.json({ valid: false });
      try {
        const payload = JSON.parse(Buffer.from(token, "base64").toString());
        if (payload.exp < Date.now()) return NextResponse.json({ valid: false, reason: "expired" });
        return NextResponse.json({ valid: true, ssa: { id: payload.id, email: payload.email, name: payload.name } });
      } catch {
        return NextResponse.json({ valid: false });
      }
    }

    // ─── CHANGE PASSWORD ────────────────────────────────────
    if (action === "change_password") {
      const { token, new_password } = body;
      if (!token || !new_password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      let payload;
      try {
        payload = JSON.parse(Buffer.from(token, "base64").toString());
        if (payload.exp < Date.now()) return NextResponse.json({ error: "Session expired" }, { status: 401 });
      } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }

      const hash = await bcrypt.hash(new_password, 10);
      await supabase
        .from("super_super_admins")
        .update({ password_hash: hash })
        .eq("id", payload.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
