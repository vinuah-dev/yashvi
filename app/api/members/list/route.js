import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, body }) => {
  const { data, error } = await supabase.rpc("get_members_paginated", {
    p_gym_id: gymId,
    p_search: body.p_search || "",
    p_status: body.p_status || "all",
    p_page: body.p_page || 1,
    p_page_size: body.p_page_size || 20,
    p_user_id: body.p_user_id || null,
    p_is_trainer: body.p_is_trainer || false,
    p_show_my_members: body.p_show_my_members || false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}, { allowBodyUserId: true });
