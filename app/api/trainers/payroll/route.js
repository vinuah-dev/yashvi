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

  try {
    // The RPC computes pt_charges at a fixed 50% trainer share. Re-scale it to
    // the admin-configured share (pt_trainer_share_percent on the gym). We back
    // out the full PT amount from the 50% figure, then apply the new percent.
    const { data: gymRow } = await supabase
      .from("gyms")
      .select("pt_trainer_share_percent")
      .eq("id", p_gym_id)
      .maybeSingle();

    const configuredPct = Number(gymRow?.pt_trainer_share_percent);
    const sharePct = Number.isFinite(configuredPct) ? configuredPct : 50;

    // A trainer with no active members isn't payable, so zero them out.
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

      // Back out full PT revenue from the RPC's 50% figure, then apply share.
      const rpcPtCharges = Number(row.pt_charges || 0);
      const fullPt = rpcPtCharges / 0.5; // RPC used 50%
      const scaledPt = Math.round(fullPt * (sharePct / 100));

      const salaryEarned = hasNoMembers ? 0 : Number(row.salary_earned || 0);
      const ptCharges = hasNoMembers ? 0 : scaledPt;
      const totalPayable = salaryEarned + ptCharges;

      return {
        ...row,
        assigned_members_count: assignedCount,
        pt_share_percent: sharePct,
        salary_earned: salaryEarned,
        pt_charges: ptCharges,
        total_payable: totalPayable,
      };
    });

    const summary = {
      ...(data?.summary || {}),
      pt_share_percent: sharePct,
      total_salary_earned: trainers.reduce((s, t) => s + Number(t.salary_earned || 0), 0),
      total_pt_charges: trainers.reduce((s, t) => s + Number(t.pt_charges || 0), 0),
      total_payable: trainers.reduce((s, t) => s + Number(t.total_payable || 0), 0),
    };

    return NextResponse.json({ data: { ...data, trainers, summary } });
  } catch {
    return NextResponse.json({ data });
  }
});
