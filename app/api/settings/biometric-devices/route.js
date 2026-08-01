import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

// Manage a gym's biometric scanners (eSSL F22, etc). Each device is identified
// by its factory Serial Number (device_sn). The ADMS server maps an incoming
// punch to the right gym using this SN — so registering a device here is all
// that's needed for a new gym/scanner to start recording attendance.
//
// Runs service-role via withAuth so it works regardless of RLS on the table.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const action = body?.action;

  // ── List all devices for this gym ──
  if (action === "list") {
    const { data, error } = await supabase
      .from("biometric_devices")
      .select("id, device_sn, device_name, location, last_seen_at, created_at")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  }

  // Everything below writes — respect view-only admins.
  const writeBlocked = await blockViewOnlyWrites(request, supabase, user.id);
  if (writeBlocked) return writeBlocked;

  // ── Add a new device ──
  if (action === "add") {
    const deviceSn = (body.device_sn || "").trim();
    if (!deviceSn) {
      return NextResponse.json({ error: "Serial Number is required" }, { status: 400 });
    }

    // The SN is globally unique. If it already exists, tell the admin where.
    const { data: existing } = await supabase
      .from("biometric_devices")
      .select("id, gym_id")
      .eq("device_sn", deviceSn)
      .maybeSingle();

    if (existing) {
      const sameGym = existing.gym_id === gymId;
      return NextResponse.json(
        { error: sameGym ? "This device is already registered for your gym." : "This Serial Number is already registered to another gym." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("biometric_devices")
      .insert({
        gym_id: gymId,
        device_sn: deviceSn,
        device_name: (body.device_name || "").trim() || null,
        location: (body.location || "").trim() || null,
      })
      .select("id, device_sn, device_name, location, last_seen_at, created_at")
      .single();

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ data });
  }

  // ── Update a device's label / location (not the SN) ──
  if (action === "update") {
    if (!body.id) return NextResponse.json({ error: "Missing device id" }, { status: 400 });
    const { error } = await supabase
      .from("biometric_devices")
      .update({
        device_name: (body.device_name || "").trim() || null,
        location: (body.location || "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("gym_id", gymId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Remove a device ──
  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Missing device id" }, { status: 400 });
    const { error } = await supabase
      .from("biometric_devices")
      .delete()
      .eq("id", body.id)
      .eq("gym_id", gymId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});
