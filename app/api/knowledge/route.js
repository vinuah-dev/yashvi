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
  const title = String(body.title || "").trim();
  const excerpt = String(body.excerpt || "").trim();
  const content = String(body.content || "").trim();
  const image_url = String(body.image_url || "").trim() || null;
  const category = VALID_CATEGORIES.has(body.category) ? body.category : "health";
  const status = body.status === "draft" ? "draft" : "published";
  const is_featured = Boolean(body.is_featured);

  return { title, excerpt, content, image_url, category, status, is_featured };
}

export const GET = withAuth(async (request, { gymId, supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const adminView = searchParams.get("admin") === "1" && canManageKnowledge(user);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

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
    .eq("gym_id", gymId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!adminView) {
    query = query.eq("status", "published");
  }

  if (category && VALID_CATEGORIES.has(category)) {
    query = query.eq("category", category);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data || []).map((post) => ({
      ...post,
      author_name:
        `${post.profiles?.first_name || ""} ${post.profiles?.last_name || ""}`.trim() ||
        "Gym Admin",
    })),
  });
});

export const POST = withAuth(async (request, { gymId, supabase, user, body }) => {
  if (!canManageKnowledge(user)) {
    return NextResponse.json(
      { error: "Only gym admins can create knowledge posts" },
      { status: 403 }
    );
  }

  const post = normalizePost(body);

  if (!post.title || !post.excerpt || !post.content) {
    return NextResponse.json(
      { error: "Title, excerpt, and content are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("knowledge_posts")
    .insert({
      ...post,
      gym_id: gymId,
      created_by: user.id,
      updated_by: user.id,
      published_at: post.status === "published" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
});
