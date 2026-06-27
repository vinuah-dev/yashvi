import { resolveUserGymId } from "@/lib/server/tenantAuth";
import { resolveProfileRole } from "@/lib/server/viewOnlyGuard";
import {
  assertMemberBelongsToGym,
  deactivateActiveTrainerAssignments,
  getActiveAssignment,
  todayDateString,
} from "@/lib/server/trainerAssignmentHelpers";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";

function daysRemainingPlan(planEndDate) {
  if (!planEndDate) return null;
  const end = new Date(`${planEndDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function parseBodyTrainerRow(body, gymId, assignedBy) {
  const start = body.plan_start_date || body.start_date || todayDateString();
  const planEnd = body.plan_end_date || null;

  const row = {
    gym_id: gymId,
    member_id: body.member_id,
    trainer_id: body.trainer_id,
    assigned_by: assignedBy || body.assigned_by || null,
    is_active: true,
    assigned_at: new Date().toISOString(),
    start_date: start,
    end_date: null,
  };

  if (body.trainer_plan_id) row.trainer_plan_id = body.trainer_plan_id;
  if (body.plan_start_date) row.plan_start_date = body.plan_start_date;
  if (planEnd) row.plan_end_date = planEnd;
  if (body.plan_total_amount != null) row.plan_total_amount = body.plan_total_amount;
  if (body.total_paid_amount != null) row.total_paid_amount = body.total_paid_amount;
  if (body.pending_amount != null) row.pending_amount = body.pending_amount;
  if (body.next_payment_date !== undefined) row.next_payment_date = body.next_payment_date || null;
  if (body.notes) row.notes = body.notes;

  return row;
}

/**
 * POST assign: deactivate current active + insert new assignment row.
 */
export async function executeTrainerAssign(body) {
  const supabase = getSupabaseAdmin();
  const pUserId = body.p_user_id;
  if (!pUserId) {
    const err = new Error("Missing p_user_id");
    err.statusCode = 401;
    throw err;
  }

  const gymId = await resolveUserGymId(supabase, pUserId);
  const actor = await resolveProfileRole(supabase, pUserId);
  if (actor?.role === "view_only") {
    const err = new Error("VIEW_ONLY role cannot perform write operations");
    err.statusCode = 403;
    throw err;
  }

  if (!gymId) {
    const err = new Error("Unauthorized user");
    err.statusCode = 403;
    throw err;
  }

  if (body.gym_id && body.gym_id !== gymId) {
    const err = new Error("Forbidden: gym access denied");
    err.statusCode = 403;
    throw err;
  }

  const memberId = body.member_id;
  const trainerId = body.trainer_id;
  if (!memberId || !trainerId) {
    const err = new Error("member_id and trainer_id are required");
    err.statusCode = 400;
    throw err;
  }

  await assertMemberBelongsToGym(supabase, memberId, gymId);

  const { error: deactErr } = await deactivateActiveTrainerAssignments(supabase, {
    gymId,
    memberId,
    endDate: body.close_end_date || todayDateString(),
  });
  if (deactErr) throw new Error(deactErr.message);

  const row = parseBodyTrainerRow(body, gymId, body.assigned_by);
  const { data, error } = await supabase.from("trainer_member_assignments").insert(row).select("id").single();

  if (error) throw new Error(error.message);
  return { assignment: data, gym_id: gymId };
}

export async function executeTrainerRenew(body) {
  const supabase = getSupabaseAdmin();
  const pUserId = body.p_user_id;
  if (!pUserId) {
    const err = new Error("Missing p_user_id");
    err.statusCode = 401;
    throw err;
  }

  const gymId = await resolveUserGymId(supabase, pUserId);
  if (!gymId) {
    const err = new Error("Unauthorized user");
    err.statusCode = 403;
    throw err;
  }

  const memberId = body.member_id;
  const trainerId = body.trainer_id;
  if (!memberId || !trainerId) {
    const err = new Error("member_id and trainer_id are required");
    err.statusCode = 400;
    throw err;
  }

  await assertMemberBelongsToGym(supabase, memberId, gymId);

  const active = await getActiveAssignment(supabase, gymId, memberId);
  if (!active) {
    const err = new Error("No active trainer assignment to renew");
    err.statusCode = 400;
    throw err;
  }
  if (active.trainer_id !== trainerId) {
    const err = new Error("Renew requires the same trainer as the current active assignment");
    err.statusCode = 400;
    throw err;
  }

  return executeTrainerAssign(body);
}

export async function executeTrainerChange(body) {
  const nextId = body.new_trainer_id || body.trainer_id;
  const copy = { ...body, trainer_id: nextId };
  return executeTrainerAssign(copy);
}

function durationDays(startDate, endDate, isActive) {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = isActive
    ? new Date()
    : endDate
      ? new Date(`${endDate}T00:00:00`)
      : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = end - start;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export async function fetchTrainerHistory(memberId, pUserId) {
  const supabase = getSupabaseAdmin();
  if (!pUserId) {
    const err = new Error("Missing p_user_id");
    err.statusCode = 401;
    throw err;
  }

  const gymId = await resolveUserGymId(supabase, pUserId);
  if (!gymId) {
    const err = new Error("Unauthorized user");
    err.statusCode = 403;
    throw err;
  }

  await assertMemberBelongsToGym(supabase, memberId, gymId);

  const { data: rows, error } = await supabase
    .from("trainer_member_assignments")
    .select(
      `
      id,
      trainer_id,
      start_date,
      end_date,
      is_active,
      plan_start_date,
      plan_end_date,
      assigned_at,
      created_at,
      trainer_plans:trainer_plan_id (name),
      profiles:trainer_id (first_name, last_name, phone)
    `
    )
    .eq("member_id", memberId)
    .eq("gym_id", gymId)
    .order("start_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  const { data: payRows, error: payErr } = await supabase
    .from("trainer_payments")
    .select("assignment_id, amount")
    .eq("member_id", memberId)
    .eq("gym_id", gymId);

  if (payErr) throw new Error(payErr.message);

  const sumByAssignment = {};
  (payRows || []).forEach((p) => {
    const id = p.assignment_id;
    if (!id) return;
    sumByAssignment[id] = (sumByAssignment[id] || 0) + Number(p.amount || 0);
  });

  const list = (rows || []).map((r) => {
    const first = r.profiles?.first_name || "";
    const last = r.profiles?.last_name || "";
    const trainerName = `${first} ${last}`.trim() || "Trainer";
    const start = r.start_date || r.plan_start_date;
    const dr = r.is_active ? daysRemainingPlan(r.plan_end_date) : null;
    return {
      id: r.id,
      trainer_id: r.trainer_id,
      trainer_name: trainerName,
      trainer_phone: r.profiles?.phone || null,
      plan_name: r.trainer_plans?.name || null,
      start_date: start,
      end_date: r.end_date,
      plan_start_date: r.plan_start_date,
      plan_end_date: r.plan_end_date,
      is_active: r.is_active,
      assigned_at: r.assigned_at,
      created_at: r.created_at,
      amount_earned: Math.round((sumByAssignment[r.id] || 0) * 100) / 100,
      duration_days: durationDays(start, r.end_date, r.is_active),
      days_remaining: dr,
      expires_within_3_days: dr != null && dr <= 3 && dr >= 0,
    };
  });

  return { gym_id: gymId, assignments: list };
}
