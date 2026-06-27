import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const { params } = body;

  if (!params) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const writeBlocked = await blockViewOnlyWrites(request, supabase, user.id);
  if (writeBlocked) return writeBlocked;

  if (params.p_gym_id !== gymId) {
    return NextResponse.json({ error: "Forbidden: gym access denied" }, { status: 403 });
  }

  const safeParams = {
    ...params,
    p_created_by: user.id,
    p_created_by_name: user.name,
    p_collected_by: user.id,
    p_collected_by_name: user.name,
  };

  if (!safeParams.p_login_value || !safeParams.p_default_password) {
    return NextResponse.json(
      { error: "Member login phone and default password are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("add_member_with_membership", safeParams);

  if (error) {
    const status = error.message?.includes("DUPLICATE_PHONE")
      ? 409
      : error.message?.includes("PAYMENT_EXCEEDS_MEMBERSHIP_TOTAL")
        ? 400
        : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ data });
});
