import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

/**
 * Workout plan assignment, server-side.
 *
 * The modal used to insert straight from the browser with the anon client,
 * which silently failed whenever RLS was on and swallowed the real Postgres
 * error behind "Please try again". Everything now runs through the service
 * role here and the actual error message is returned to the UI.
 *
 * Actions:
 *   assign        - link an existing plan to a member
 *   create_assign - create a member-specific plan (+days/exercises) and link it
 */
export const POST = withAuth(async (request, { user, gymId, supabase, body }) => {
  const action = body?.action || "assign";

  const writeBlocked = await blockViewOnlyWrites(request, supabase, user.id);
  if (writeBlocked) return writeBlocked;

  const memberId = body?.member_id;
  if (!memberId) {
    return NextResponse.json({ error: "Missing member_id" }, { status: 400 });
  }

  // Make sure the member actually belongs to the caller's gym
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, gym_id, full_name")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (member.gym_id !== gymId) {
    return NextResponse.json({ error: "Forbidden: gym access denied" }, { status: 403 });
  }

  const trainerId = body?.trainer_id || user?.id || null;

  // Only reference a profile that really exists, otherwise the FK blows up
  let assignedByTrainerId = null;
  if (trainerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", trainerId)
      .maybeSingle();
    assignedByTrainerId = profile?.id || null;
  }

  // ─── Replace the member's current plan link ──────────────
  const replaceAssignment = async (planId) => {
    const { error: delError } = await supabase
      .from("member_workouts")
      .delete()
      .eq("member_id", memberId);

    if (delError) return delError;

    const { error: insError } = await supabase
      .from("member_workouts")
      .insert({
        member_id: memberId,
        workout_plan_id: planId,
        assigned_by_trainer_id: assignedByTrainerId,
      });

    return insError || null;
  };

  // ─── Assign an existing plan ─────────────────────────────
  if (action === "assign") {
    const planId = body?.workout_plan_id;
    if (!planId) {
      return NextResponse.json({ error: "Missing workout_plan_id" }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("workout_plans")
      .select("id, gym_id, title")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }
    if (!plan) {
      return NextResponse.json({ error: "Workout plan not found" }, { status: 404 });
    }
    if (plan.gym_id !== gymId) {
      return NextResponse.json({ error: "Forbidden: plan belongs to another gym" }, { status: 403 });
    }

    const { data: already } = await supabase
      .from("member_workouts")
      .select("id")
      .eq("member_id", memberId)
      .eq("workout_plan_id", planId)
      .maybeSingle();

    if (already) {
      return NextResponse.json(
        { error: "This workout plan is already assigned to this member" },
        { status: 409 },
      );
    }

    const assignError = await replaceAssignment(planId);
    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: { workout_plan_id: planId, title: plan.title, member_name: member.full_name },
    });
  }

  // ─── Create a member-specific plan and assign it ─────────
  if (action === "create_assign") {
    const title = (body?.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Plan title is required" }, { status: 400 });
    }

    const creatorName = user?.name || null;

    const planPayload = {
      gym_id: gymId,
      title,
      description: body?.description || null,
      goal: body?.goal || null,
      level: body?.level || null,
      is_template: false,
      created_by: assignedByTrainerId,
      member_id: memberId,
      trainer_id: assignedByTrainerId,
    };
    if (creatorName) planPayload.created_by_name = creatorName;

    const { data: newPlan, error: planError } = await supabase
      .from("workout_plans")
      .insert(planPayload)
      .select("id")
      .single();

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    const planId = newPlan.id;

    // Days + exercises. If anything fails, roll the plan back so we don't
    // leave a half-built plan floating in the gym.
    const rollback = async (message, status = 500) => {
      await supabase.from("workout_plans").delete().eq("id", planId);
      return NextResponse.json({ error: message }, { status });
    };

    const days = Array.isArray(body?.days) ? body.days : [];

    for (const day of days) {
      const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
      const usable = exercises.filter((ex) => (ex?.exercise_name || "").trim());

      if (usable.length === 0 && !day?.focus) continue;

      const { data: dayRow, error: dayError } = await supabase
        .from("workout_plan_days")
        .insert({
          workout_plan_id: planId,
          day_of_week: Number(day.day_of_week),
          day_name: day.day_name,
          focus: day.focus || null,
        })
        .select("id")
        .single();

      if (dayError) {
        return rollback(`Day "${day.day_name}": ${dayError.message}`);
      }

      if (usable.length === 0) continue;

      const rows = usable.map((ex, index) => {
        const row = {
          workout_day_id: dayRow.id,
          exercise_name: ex.exercise_name.trim(),
          sets: ex.sets === "" || ex.sets == null ? null : Number(ex.sets),
          reps: ex.reps || null,
          weight: ex.weight || null,
          rest_seconds:
            ex.rest_seconds === "" || ex.rest_seconds == null ? null : Number(ex.rest_seconds),
          notes: ex.notes || null,
          exercise_order: index + 1,
        };
        if (ex.timing_minutes !== undefined && ex.timing_minutes !== "" && ex.timing_minutes !== null) {
          row.timing_minutes = Number(ex.timing_minutes);
        }
        return row;
      });

      let { error: exError } = await supabase.from("workout_exercises").insert(rows);

      // Older databases may not have timing_minutes yet — retry without it
      if (exError && /timing_minutes/i.test(exError.message || "")) {
        const stripped = rows.map(({ timing_minutes, ...rest }) => rest);
        ({ error: exError } = await supabase.from("workout_exercises").insert(stripped));
      }

      if (exError) {
        return rollback(`Exercises for "${day.day_name}": ${exError.message}`);
      }
    }

    const assignError = await replaceAssignment(planId);
    if (assignError) {
      return rollback(assignError.message);
    }

    return NextResponse.json({
      data: { workout_plan_id: planId, title, member_name: member.full_name },
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});
