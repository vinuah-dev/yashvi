import { NextResponse } from "next/server";

export function getRequestUserId(request) {
  const headerUserId = request.headers.get("x-user-id");
  return headerUserId ? String(headerUserId) : null;
}

export async function resolveProfileContextById(supabaseAdmin, userId) {
  if (!userId) return null;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, gym_id, first_name, last_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile?.id) {
    return null;
  }

  const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || null;

  return {
    id: profile.id,
    gym_id: profile.gym_id,
    name,
    role: profile.role,
  };
}

/** Resolves gym_id for API routes (profile first, then members table). */
export async function resolveUserGymId(supabaseAdmin, userId) {
  if (!userId) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("gym_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.gym_id) return profile.gym_id;

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("gym_id")
    .eq("id", userId)
    .maybeSingle();

  return member?.gym_id || null;
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
