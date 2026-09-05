import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

// Trainer attendance for a month, including hours worked and what that earns.
//
// This returns salary, PT charges and total payable, so it is not public: the
// gym is taken from the caller's own profile rather than the request body (so
// nobody can read another gym's figures), and a trainer may only ask for their
// own record while gym staff may ask for anyone at their gym.
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const trainerId = body?.p_trainer_id;

  if (!trainerId) {
    return NextResponse.json({ error: "Missing p_trainer_id" }, { status: 400 });
  }

  if (!gymId) {
    return NextResponse.json({ error: "No gym for this user" }, { status: 400 });
  }

  if (user.role === "trainer" && String(user.id) !== String(trainerId)) {
    return NextResponse.json(
      { error: "You can only view your own attendance" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase.rpc("get_trainer_attendance_summary", {
    p_gym_id: gymId,
    p_trainer_id: trainerId,
    p_month: body?.p_month || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});
