import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/apiMiddleware";

export const POST = withApi(async (request, { supabase }) => {
  const { p_trainer_id, p_gym_id } = await request.json();

  if (!p_trainer_id || !p_gym_id) {
    return NextResponse.json(
      { error: "Missing p_trainer_id or p_gym_id" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("get_trainer_details", {
    p_trainer_id,
    p_gym_id,
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
