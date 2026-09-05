import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

// Includes the trainer's cost and payment history, so the gym is taken from
// the authenticated caller rather than the request body.
export const POST = withAuth(async (request, { gymId, supabase, body }) => {
  const p_trainer_id = body?.p_trainer_id;

  if (!p_trainer_id) {
    return NextResponse.json({ error: "Missing p_trainer_id" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_trainer_details", {
    p_trainer_id,
    p_gym_id: gymId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Safety filter: keep only paid payment activities
  let sanitizedData = data;
  const activityLog = Array.isArray(data?.activity_log) ? data.activity_log : [];
  const paymentActivityIds = activityLog
    .filter((item) => item?.type === "payment" && typeof item?.id === "string" && item.id.startsWith("payment-"))
    .map((item) => item.id.replace("payment-", ""));

  if (paymentActivityIds.length > 0) {
    const { data: paymentRows } = await supabase
      .from("payments")
      .select("id, status")
      .in("id", paymentActivityIds);

    const paidPaymentIds = new Set(
      (paymentRows || [])
        .filter((row) => String(row.status || "").toLowerCase() === "paid")
        .map((row) => String(row.id))
    );

    sanitizedData = {
      ...data,
      activity_log: activityLog.filter((item) => {
        if (item?.type !== "payment" || typeof item?.id !== "string") return true;
        const paymentId = item.id.replace("payment-", "");
        return paidPaymentIds.has(paymentId);
      }),
    };
  }

  return NextResponse.json({ data: sanitizedData });
});
