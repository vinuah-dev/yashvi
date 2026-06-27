import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";
import {
  forbidden,
  getRequestUserId,
  resolveProfileContextById,
  unauthorized,
} from "@/lib/server/tenantAuth";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

const supabaseAdmin = getSupabaseAdmin();

function resolveMembershipTotalAmount(membershipRow) {
  const totalAmount = Number(membershipRow?.total_amount ?? 0);
  if (totalAmount > 0) return totalAmount;
  const customPrice = Number(membershipRow?.custom_price ?? 0);
  if (customPrice > 0) return customPrice;
  const planPrice = Number(membershipRow?.membership_plans?.price ?? 0);
  return planPrice > 0 ? planPrice : 0;
}

export async function POST(request) {
  try {
    const {
      p_gym_id,
      p_member_id,
      p_membership_id,
      p_amount,
      p_payment_mode,
      p_status,
      p_paid_at,
      p_created_at,
      p_notes,
      p_next_payment_date,
      p_remaining_amount,
      p_collected_by,
      p_collected_by_name,
    } = await request.json();

    if (!p_member_id || !p_amount || !p_payment_mode) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const currentUserId = getRequestUserId(request);
    if (!currentUserId) {
      return unauthorized("Missing authenticated user");
    }
    const writeBlocked = await blockViewOnlyWrites(request, supabaseAdmin, currentUserId);
    if (writeBlocked) return writeBlocked;

    const collector = await resolveProfileContextById(supabaseAdmin, currentUserId);
    if (!collector) {
      return unauthorized("Invalid authenticated user");
    }

    const { data: member } = await supabaseAdmin
      .from("members")
      .select("id, gym_id")
      .eq("id", p_member_id)
      .maybeSingle();

    if (!member) {
      return forbidden("Invalid member");
    }

    const finalGymId = member.gym_id;
    if (!finalGymId) {
      return forbidden("Invalid member gym");
    }

    if (collector.gym_id !== finalGymId) {
      console.warn("[TenantCheck][finance/payments/create][rejected] collector-member gym mismatch", {
        current_user_id: collector.id,
        current_user_gym_id: collector.gym_id,
        collected_by: p_collected_by || null,
        collector_gym_id: collector.gym_id,
        transaction_gym_id: finalGymId,
      });
      return forbidden("Invalid collector (cross-gym)");
    }

    if (p_gym_id && p_gym_id !== finalGymId) {
      return forbidden("Forbidden: gym access denied");
    }

    const membershipSelect = `
      id,
      member_id,
      gym_id,
      status,
      total_amount,
      custom_price,
      start_date,
      end_date,
      created_at,
      membership_plans (
        price
      )
    `;

    let membershipRows = [];
    let membershipError = null;

    if (p_membership_id) {
      const response = await supabaseAdmin
        .from("memberships")
        .select(membershipSelect)
        .eq("id", p_membership_id)
        .eq("member_id", p_member_id)
        .eq("gym_id", finalGymId)
        .limit(1);
      membershipRows = response.data || [];
      membershipError = response.error;
    } else {
      const candidatesResponse = await supabaseAdmin
        .from("memberships")
        .select(membershipSelect)
        .eq("member_id", p_member_id)
        .eq("gym_id", finalGymId)
        .order("end_date", { ascending: false })
        .order("start_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(25);

      membershipError = candidatesResponse.error;
      membershipRows = candidatesResponse.data || [];

      if (!membershipError && membershipRows.length > 0) {
        const membershipIds = membershipRows.map((membership) => membership.id).filter(Boolean);

        const { data: paidRowsByMembership, error: paidRowsByMembershipError } = await supabaseAdmin
          .from("payments")
          .select("membership_id, amount")
          .in("membership_id", membershipIds)
          .eq("status", "paid");

        if (paidRowsByMembershipError) {
          return NextResponse.json({ error: paidRowsByMembershipError.message }, { status: 500 });
        }

        const paidByMembership = (paidRowsByMembership || []).reduce((acc, row) => {
          const key = row.membership_id;
          acc[key] = (acc[key] || 0) + Number(row.amount || 0);
          return acc;
        }, {});

        const firstWithDue = membershipRows.find((membership) => {
          const totalAmount = resolveMembershipTotalAmount(membership);
          const paidAmount = Number(paidByMembership[membership.id] || 0);
          return Math.max(0, totalAmount - paidAmount) > 0;
        });

        membershipRows = firstWithDue ? [firstWithDue] : [membershipRows[0]];
      }
    }

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    const selectedMembership = Array.isArray(membershipRows)
      ? membershipRows[0] || null
      : membershipRows || null;

    if (!selectedMembership?.id) {
      return NextResponse.json(
        { error: "No membership found for this member" },
        { status: 400 }
      );
    }

    const membershipTotalAmount = resolveMembershipTotalAmount(selectedMembership);
    if (membershipTotalAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid membership total amount" },
        { status: 400 }
      );
    }

    const { data: paidRows, error: paidRowsError } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("membership_id", selectedMembership.id)
      .eq("status", "paid");

    if (paidRowsError) {
      return NextResponse.json({ error: paidRowsError.message }, { status: 500 });
    }

    const totalPaid = (paidRows || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );
    const dueAmount = Math.max(0, membershipTotalAmount - totalPaid);

    const normalizedStatus = String(p_status || "paid").toLowerCase();
    const requestAmount = Number(p_amount);
    if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    let finalCollectorId = null;
    let finalCollectorName = null;

    if (normalizedStatus === "paid") {
      if (dueAmount <= 0) {
        return NextResponse.json(
          { error: "Membership is already fully paid" },
          { status: 400 }
        );
      }

      if (requestAmount > dueAmount) {
        return NextResponse.json(
          {
            error: `Payment exceeds due amount. Max allowed: ${dueAmount}`,
          },
          { status: 400 }
        );
      }

      finalCollectorId = collector.id;
      finalCollectorName = collector.name;
    }

    console.log("[TenantCheck][finance/payments/create][write]", {
      current_user_id: collector.id,
      current_user_gym_id: collector.gym_id,
      collected_by_request: p_collected_by || null,
      collected_by_name_request: p_collected_by_name || null,
      collected_by_final: finalCollectorId,
      collector_gym_id: collector.gym_id,
      transaction_gym_id: finalGymId,
      membership_id: selectedMembership.id,
      membership_total_amount: membershipTotalAmount,
      total_paid_before_write: totalPaid,
      due_before_write: dueAmount,
    });

    const { data: insertedPayment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        gym_id: finalGymId,
        member_id: p_member_id,
        membership_id: selectedMembership.id,
        amount: requestAmount,
        payment_mode: p_payment_mode,
        status: normalizedStatus,
        paid_at: p_paid_at || null,
        created_at: p_created_at || new Date().toISOString(),
        notes: p_notes || null,
        next_payment_date: p_next_payment_date || null,
        remaining_amount: p_remaining_amount ?? null,
        collected_by: finalCollectorId,
        collected_by_name: finalCollectorName,
      })
      .select("id, gym_id, collected_by, collected_by_name, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (normalizedStatus === "paid") {
      const nextDue = Math.max(0, dueAmount - requestAmount);
      await supabaseAdmin
        .from("members")
        .update({ balance: nextDue })
        .eq("id", p_member_id)
        .eq("gym_id", finalGymId);
    }

    return NextResponse.json({ data: insertedPayment });
  } catch (err) {
    console.error("API /finance/payments/create error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
