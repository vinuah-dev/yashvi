import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

const ADMIN_ROLES = new Set(["superadmin", "owner", "admin"]);
const VALID_CATEGORIES = new Set([
  "health",
  "nutrition",
  "workout",
  "recovery",
  "announcement",
]);

function canManageKnowledge(user) {
  return ADMIN_ROLES.has(user?.role);
}

function normalizePost(body = {}) {
  const payload = {};

  if (body.title !== undefined) payload.title = String(body.title || "").trim();
  if (body.excerpt !== undefined) payload.excerpt = String(body.excerpt || "").trim();
  if (body.content !== undefined) payload.content = String(body.content || "").trim();
  if (body.image_url !== undefined) payload.image_url = String(body.image_url || "").trim() || null;
  if (VALID_CATEGORIES.has(body.category)) payload.category = body.category;
  if (body.status === "draft" || body.status === "published") payload.status = body.status;
  if (body.is_featured !== undefined) payload.is_featured = Boolean(body.is_featured);

  return payload;
}

export const GET = withAuth(async (request, { gymId, supabase, user }, { params }) => {
  const { id } = await params;
  if (!id || id === "undefined") {
    return NextResponse.json({ error: "Knowledge post not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const adminView = searchParams.get("admin") === "1" && canManageKnowledge(user);

  let query = supabase
    .from("knowledge_posts")
    .select(`
      id,
      gym_id,
      title,
      excerpt,
      content,
      image_url,
      category,
      status,
      is_featured,
      published_at,
      created_at,
      updated_at,
      created_by,
      profiles:created_by (
        first_name,
        last_name
      )
    `)
    .eq("id", id)
    .eq("gym_id", gymId);

  if (!adminView) {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Knowledge post not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...data,
      author_name:
        `${data.profiles?.first_name || ""} ${data.profiles?.last_name || ""}`.trim() ||
        "Gym Admin",
    },
  });
});

export const PATCH = withAuth(async (request, { gymId, supabase, user, body }, { params }) => {
  const { id } = await params;
  if (!id || id === "undefined") {
    return NextResponse.json({ error: "Knowledge post not found" }, { status: 404 });
  }

  if (!canManageKnowledge(user)) {
    return NextResponse.json(
      { error: "Only gym admins can update knowledge posts" },
      { status: 403 }
    );
  }

  const post = normalizePost(body);

  if (
    (post.title !== undefined && !post.title) ||
    (post.excerpt !== undefined && !post.excerpt) ||
    (post.content !== undefined && !post.content)
  ) {
    return NextResponse.json(
      { error: "Title, excerpt, and content cannot be empty" },
      { status: 400 }
    );
  }

  const updates = {
    ...post,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (post.status === "published") {
    updates.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("knowledge_posts")
    .update(updates)
    .eq("id", id)
    .eq("gym_id", gymId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Knowledge post not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
});

export const DELETE = withAuth(async (request, { gymId, supabase, user }, { params }) => {
  const { id } = await params;
  if (!id || id === "undefined") {
    return NextResponse.json({ error: "Knowledge post not found" }, { status: 404 });
  }

  if (!canManageKnowledge(user)) {
    return NextResponse.json(
      { error: "Only gym admins can delete knowledge posts" },
      { status: 403 }
    );
  }

  const { error, count } = await supabase
    .from("knowledge_posts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("gym_id", gymId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!count) {
    return NextResponse.json({ error: "Knowledge post not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
