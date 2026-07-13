import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/apiMiddleware";

export const POST = withApi(async (request, { supabase }) => {
  const { p_gym_id, p_month } = await request.json();

  if (!p_gym_id) {
    return NextResponse.json({ error: "Missing p_gym_id" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_trainer_payroll_dashboard", {
    p_gym_id,
    p_month: p_month || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A trainer with no members assigned is not payable, so their salary is
  // forced to zero here rather than relying on the attendance-based figure
  // the RPC returns. The active-assignment count is read straight from
  // trainer_member_assignments so this does not depend on the RPC exposing
  // a member-count column.
  try {
    const { data: assignments } = await supabase
      .from("trainer_member_assignments")
      .select("trainer_id")
      .eq("gym_id", p_gym_id)
      .eq("is_active", true);

    const countByTrainer = new Map();
    (assignments || []).forEach((row) => {
      const key = String(row.trainer_id);
      countByTrainer.set(key, (countByTrainer.get(key) || 0) + 1);
    });

    const trainers = (data?.trainers || []).map((row) => {
      const trainerKey = String(row.trainer_id ?? row.profile_id ?? "");
      const assignedCount = countByTrainer.get(trainerKey) || 0;
      const hasNoMembers = assignedCount === 0;

      return {
        ...row,
        assigned_members_count: assignedCount,
        salary_earned: hasNoMembers ? 0 : Number(row.salary_earned || 0),
        pt_charges: hasNoMembers ? 0 : Number(row.pt_charges || 0),
        total_payable: hasNoMembers ? 0 : Number(row.total_payable || 0),
      };
    });

    const summary = {
      ...(data?.summary || {}),
      total_salary_earned: trainers.reduce((s, t) => s + Number(t.salary_earned || 0), 0),
      total_pt_charges: trainers.reduce((s, t) => s + Number(t.pt_charges || 0), 0),
      total_payable: trainers.reduce((s, t) => s + Number(t.total_payable || 0), 0),
    };

    return NextResponse.json({ data: { ...data, trainers, summary } });
  } catch {
    // If the adjustment fails for any reason, fall back to the raw RPC result
    // rather than breaking the payroll screen.
    return NextResponse.json({ data });
  }
});
