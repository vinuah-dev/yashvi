import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

function getMonthRangeUtc(month, year) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function getPaymentTimestamp(payment) {
  const raw = payment?.paid_at || payment?.created_at;
  if (!raw) return Number.NaN;
  return new Date(raw).getTime();
}

async function enrichInsightsWithPaymentAmounts(supabase, baseData, gymId, month, year) {
  if (!baseData || typeof baseData !== "object") return baseData;

  const newJoins = Array.isArray(baseData.month_new_joins_list)
    ? baseData.month_new_joins_list
    : [];
  const renewals = Array.isArray(baseData.month_renewals_list)
    ? baseData.month_renewals_list
    : [];

  if (newJoins.length === 0 && renewals.length === 0) {
    return baseData;
  }

  const renewalPhones = Array.from(
    new Set(renewals.map((item) => item?.phone).filter(Boolean))
  );

  // Collect IDs from new joins immediately (no DB call needed)
  const memberIds = new Set();
  newJoins.forEach((item) => {
    if (item?.id) memberIds.add(item.id);
  });

  // Fetch renewal members by phone (only if needed)
  const membersByPhone = new Map();
  if (renewalPhones.length > 0) {
    const { data: renewalMembers } = await supabase
      .from("members")
      .select("id, phone")
      .eq("gym_id", gymId)
      .in("phone", renewalPhones);

    (renewalMembers || []).forEach((member) => {
      if (member?.phone) {
        membersByPhone.set(member.phone, member.id);
        memberIds.add(member.id);
      }
    });
  }

  renewals.forEach((item) => {
    const memberId = item?.phone ? membersByPhone.get(item.phone) : null;
    if (memberId) memberIds.add(memberId);
  });

  if (memberIds.size === 0) {
    return {
      ...baseData,
      month_new_joins_list: newJoins.map((item) => ({ ...item, payment_amount: null })),
      month_renewals_list: renewals.map((item) => ({ ...item, payment_amount: null })),
    };
  }

  const { start, end } = getMonthRangeUtc(month, year);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { data: paymentsData } = await supabase
    .from("payments")
    .select("member_id, membership_id, amount, paid_at, created_at")
    .eq("gym_id", gymId)
    .eq("status", "paid")
    .in("member_id", Array.from(memberIds))
    .or(
      `and(paid_at.gte.${startIso},paid_at.lte.${endIso}),and(paid_at.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`
    )
    .order("created_at", { ascending: true });

  const payments = (paymentsData || [])
    .map((payment) => ({ ...payment, _ts: getPaymentTimestamp(payment) }))
    .filter((payment) => !Number.isNaN(payment._ts) && payment._ts >= start.getTime() && payment._ts <= end.getTime());

  const firstPaymentByMember = new Map();
  const sumByMembership = new Map();

  payments
    .sort((left, right) => left._ts - right._ts)
    .forEach((payment) => {
      if (payment.member_id && !firstPaymentByMember.has(payment.member_id)) {
        firstPaymentByMember.set(payment.member_id, Number(payment.amount || 0));
      }
      if (payment.membership_id) {
        const current = sumByMembership.get(payment.membership_id) || 0;
        sumByMembership.set(payment.membership_id, current + Number(payment.amount || 0));
      }
    });

  const enrichedNewJoins = newJoins.map((item) => ({
    ...item,
    payment_amount: item?.id ? firstPaymentByMember.get(item.id) ?? null : null,
  }));

  const enrichedRenewals = renewals.map((item) => {
    const renewalMembershipAmount = item?.id ? sumByMembership.get(item.id) : null;
    const fallbackMemberAmount = item?.phone
      ? firstPaymentByMember.get(membersByPhone.get(item.phone))
      : null;

    return {
      ...item,
      payment_amount:
        renewalMembershipAmount !== undefined && renewalMembershipAmount !== null
          ? renewalMembershipAmount
          : fallbackMemberAmount ?? null,
    };
  });

  return {
    ...baseData,
    month_new_joins_list: enrichedNewJoins,
    month_renewals_list: enrichedRenewals,
  };
}

export const POST = withAuth(async (request, { gymId, supabase, body }) => {
  const { p_month, p_year } = body;

  if (!p_month || !p_year) {
    return NextResponse.json(
      { error: "Missing required parameters: p_month, p_year" },
      { status: 400 }
    );
  }

  const month = parseInt(p_month);
  const year = parseInt(p_year);

  const { data, error } = await supabase.rpc("get_finance_insights", {
    p_gym_id: gymId,
    p_month: month,
    p_year: year,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enrichedData = await enrichInsightsWithPaymentAmounts(supabase, data, gymId, month, year);

  return NextResponse.json({ data: enrichedData });
}, { allowBodyUserId: true });
