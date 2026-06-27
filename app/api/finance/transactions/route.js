import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase }) => {
  const { data: payments, error } = await supabase
    .from("payments")
    .select(`
      id,
      gym_id,
      amount,
      payment_mode,
      status,
      paid_at,
      created_at,
      membership_id,
      collected_by,
      collected_by_name,
      members (
        id,
        full_name,
        phone
      ),
      collector:profiles!collected_by (
        id,
        gym_id,
        first_name,
        last_name
      )
    `)
    .eq("gym_id", gymId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transactions = (payments || []).map((payment) => {
    const collectorGymId = payment.collector?.gym_id || null;
    const collectorName =
      collectorGymId && collectorGymId === gymId
        ? `${payment.collector?.first_name || ""} ${payment.collector?.last_name || ""}`.trim() || null
        : null;
    const fallbackCollectorName = payment.collected_by_name || null;

    return {
      id: payment.id,
      transaction_gym_id: payment.gym_id,
      name: payment.members?.full_name || "Unknown",
      type: payment.membership_id ? "membership" : "personal_training",
      amount: parseFloat(payment.amount || 0),
      mode: payment.payment_mode?.toLowerCase() || "cash",
      date: payment.paid_at || payment.created_at,
      status: payment.status || "paid",
      collected_by: payment.collected_by || null,
      collector_gym_id: collectorGymId,
      collector_name: collectorName || fallbackCollectorName,
      collectedBy: collectorName || fallbackCollectorName || null,
    };
  });

  return NextResponse.json({ data: transactions });
});
