import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/apiMiddleware";

export const POST = withApi(async (request, { supabase }) => {
  const { p_gym_id } = await request.json();

  if (!p_gym_id) {
    return NextResponse.json({ error: "Missing p_gym_id" }, { status: 400 });
  }

  const [dashboardRpc, expensesResult, assignmentsResult, earningsResult, paymentsResult] = await Promise.all([
    supabase.rpc("get_dashboard_data", { p_gym_id }),
    supabase
      .from("expenses")
      .select("id, category, amount, expense_date, notes, created_at")
      .eq("gym_id", p_gym_id)
      .order("expense_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("trainer_member_assignments")
      .select(
        "id, gym_id, member_id, trainer_id, plan_start_date, plan_end_date, assigned_at, plan_total_amount, total_paid_amount, pending_amount, next_payment_date"
      )
      .eq("gym_id", p_gym_id)
      .order("plan_start_date", { ascending: true, nullsFirst: false })
      .order("assigned_at", { ascending: true }),
    supabase
      .from("trainer_earnings")
      .select("id, assignment_id, member_id, trainer_id, total_amount, payment_mode, created_at")
      .eq("gym_id", p_gym_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select(
        "id, gym_id, member_id, amount, payment_mode, remaining_amount, paid_at, created_at, members(full_name, balance)"
      )
      .eq("gym_id", p_gym_id)
      .order("paid_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  // Check for errors
  for (const result of [dashboardRpc, expensesResult, assignmentsResult, earningsResult, paymentsResult]) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
  }

  const assignments = assignmentsResult.data || [];
  const memberIds = Array.from(new Set(assignments.map((item) => item.member_id).filter(Boolean)));
  const trainerIds = Array.from(new Set(assignments.map((item) => item.trainer_id).filter(Boolean)));

  const [membersResult, trainersResult] = await Promise.all([
    memberIds.length
      ? supabase.from("members").select("id, full_name").eq("gym_id", p_gym_id).in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    trainerIds.length
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", trainerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (membersResult.error) {
    return NextResponse.json({ error: membersResult.error.message }, { status: 500 });
  }
  if (trainersResult.error) {
    return NextResponse.json({ error: trainersResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      dashboard: dashboardRpc.data || {},
      payments_export: (paymentsResult.data || []).map((payment) => ({
        id: payment.id,
        member_id: payment.member_id,
        member_name: payment.members?.full_name || "Member",
        amount: payment.amount,
        payment_mode: payment.payment_mode,
        remaining_amount: payment.remaining_amount,
        member_balance: payment.members?.balance,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
      })),
      expenses: expensesResult.data || [],
      trainer_assignments: assignments,
      trainer_earnings: earningsResult.data || [],
      members: membersResult.data || [],
      trainers: trainersResult.data || [],
    },
  });
});
