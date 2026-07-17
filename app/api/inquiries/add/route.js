import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

// Insert a new inquiry server-side (service-role) so it works regardless of
// RLS state on the `inquiries` table. The client sends the inquiry payload;
// gym + creator are enforced here from the authenticated context.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const inquiry = body?.inquiry;

  if (!inquiry) {
    return NextResponse.json({ error: "Missing inquiry data" }, { status: 400 });
  }

  const writeBlocked = await blockViewOnlyWrites(request, supabase, user.id);
  if (writeBlocked) return writeBlocked;

  if (inquiry.gym_id && inquiry.gym_id !== gymId) {
    return NextResponse.json({ error: "Forbidden: gym access denied" }, { status: 403 });
  }

  const fullName = (inquiry.full_name || "").trim();
  const phone = (inquiry.phone || "").replace(/\s|-/g, "");

  if (!fullName || !phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  // Duplicate phone guard within this gym
  const { data: existing } = await supabase
    .from("inquiries")
    .select("id, full_name")
    .eq("gym_id", gymId)
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `DUPLICATE_PHONE:${existing.full_name || ""}` },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      gym_id: gymId,
      full_name: fullName,
      phone,
      visit_date: inquiry.visit_date || null,
      follow_up_date: inquiry.follow_up_date || null,
      interested_plan: inquiry.interested_plan || null,
      status: inquiry.status || "new",
      notes: (inquiry.notes || "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ data });
});
