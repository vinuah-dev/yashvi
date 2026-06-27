import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, user, body }) => {
  const action = body?.action;

  // ─── List challenges ────────────────────────────────────
  if (action === "list") {
    const { data, error } = await supabase.rpc("get_gym_challenges", {
      p_gym_id: gymId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── Get challenge leaderboard ──────────────────────────
  if (action === "leaderboard") {
    const { data, error } = await supabase.rpc("get_challenge_leaderboard", {
      p_challenge_id: body.challenge_id,
      p_limit: body.limit || 50,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── Create challenge (admin only) ──────────────────────
  if (action === "create") {
    const { data, error } = await supabase
      .from("gym_challenges")
      .insert({
        gym_id: gymId,
        title: body.title,
        description: body.description || null,
        challenge_type: body.challenge_type,
        custom_unit: body.custom_unit || null,
        start_date: body.start_date,
        end_date: body.end_date,
        created_by: user?.id,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── Update challenge ───────────────────────────────────
  if (action === "update") {
    const updates = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("gym_challenges")
      .update(updates)
      .eq("id", body.challenge_id)
      .eq("gym_id", gymId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Delete challenge ───────────────────────────────────
  if (action === "delete") {
    const { error } = await supabase
      .from("gym_challenges")
      .delete()
      .eq("id", body.challenge_id)
      .eq("gym_id", gymId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Update participant score (custom challenges) ───────
  if (action === "update_score") {
    const { error } = await supabase
      .from("challenge_participants")
      .upsert(
        {
          challenge_id: body.challenge_id,
          member_id: body.member_id,
          score: body.score,
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "challenge_id,member_id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, { allowBodyUserId: true });
