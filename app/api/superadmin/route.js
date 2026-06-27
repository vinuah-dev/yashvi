import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, user, body }) => {
  // Only superadmin can use these endpoints
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json(
      { error: "Unauthorized — superadmin only" },
      { status: 403 }
    );
  }

  const action = body?.action;

  // ─── List all admins for this gym ──────────────────────
  if (action === "list") {
    const { data, error } = await supabase.rpc("get_gym_admins", {
      p_gym_id: gymId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── Toggle admin active/inactive ─────────────────────
  if (action === "toggle_access") {
    const { data, error } = await supabase.rpc("toggle_admin_access", {
      p_admin_id: body.admin_id,
      p_gym_id: gymId,
      p_is_active: body.is_active,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ data });
  }

  // ─── Update admin permissions ─────────────────────────
  if (action === "update_permissions") {
    const { data, error } = await supabase.rpc("update_admin_permissions", {
      p_admin_id: body.admin_id,
      p_gym_id: gymId,
      p_permissions: body.permissions,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ data });
  }

  // ─── Add new admin ────────────────────────────────────
  if (action === "add_admin") {
    // Check if email/phone already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("gym_id", gymId)
      .or(`email.eq.${body.email},phone.eq.${body.phone}`)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Admin with this email/phone already exists" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        first_name: body.first_name,
        last_name: body.last_name || "",
        email: body.email || null,
        phone: body.phone,
        password: body.password,
        role: body.role || "admin",
        gym_id: gymId,
        permissions: body.permissions || {
          dashboard: true,
          members: true,
          attendance: true,
          announcements: true,
          finance: false,
          analytics: true,
          monitoring: true,
          settings: true,
          inquiries: true,
        },
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── Remove admin ─────────────────────────────────────
  if (action === "remove_admin") {
    // Cannot remove superadmin or owner
    const { data: target } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", body.admin_id)
      .eq("gym_id", gymId)
      .single();

    if (target?.role === "superadmin" || target?.role === "owner") {
      return NextResponse.json({ error: "Cannot remove superadmin or owner" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", body.admin_id)
      .eq("gym_id", gymId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Change admin role ────────────────────────────────
  if (action === "change_role") {
    const allowedRoles = ["admin", "view_only"];
    if (!allowedRoles.includes(body.new_role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: body.new_role })
      .eq("id", body.admin_id)
      .eq("gym_id", gymId)
      .in("role", ["admin", "view_only"]); // Can only change admin/view_only roles

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, { allowBodyUserId: true });
