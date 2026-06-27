/**
 * Server-side helpers for trainer_member_assignments (soft-close only, no deletes).
 */

export function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

export async function assertMemberBelongsToGym(supabaseAdmin, memberId, gymId) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, gym_id, full_name")
    .eq("id", memberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id || data.gym_id !== gymId) {
    const err = new Error("Member not found in this gym");
    err.statusCode = 403;
    throw err;
  }
  return data;
}

/**
 * Soft-close all active assignments for a member at a gym (renew / change / assign / remove).
 */
export async function deactivateActiveTrainerAssignments(supabaseAdmin, { gymId, memberId, endDate }) {
  const end = endDate || todayDateString();
  return supabaseAdmin
    .from("trainer_member_assignments")
    .update({ is_active: false, end_date: end })
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .eq("is_active", true);
}

export async function getActiveAssignment(supabaseAdmin, gymId, memberId) {
  const { data, error } = await supabaseAdmin
    .from("trainer_member_assignments")
    .select("id, trainer_id, is_active")
    .eq("gym_id", gymId)
    .eq("member_id", memberId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
