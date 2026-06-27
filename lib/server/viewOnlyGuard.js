import { forbidden, getRequestUserId, unauthorized } from "@/lib/server/tenantAuth";

export async function resolveProfileRole(supabaseAdmin, userId) {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  return data || null;
}

export async function blockViewOnlyWrites(request, supabaseAdmin, explicitUserId = null) {
  const userId = explicitUserId || getRequestUserId(request);
  if (!userId) {
    return unauthorized("Missing authenticated user");
  }
  const actor = await resolveProfileRole(supabaseAdmin, userId);
  if (!actor?.id) {
    return unauthorized("Invalid authenticated user");
  }
  if (actor.role === "view_only") {
    return forbidden("VIEW_ONLY role cannot perform write operations");
  }
  return null;
}
