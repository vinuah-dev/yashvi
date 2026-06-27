import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

export const POST = withAuth(async (request, { gymId, supabase, user, body }) => {
  const action = body?.action;

  // ─── List shop items ───────────────────────────────────
  if (action === "list_items") {

    let query = supabase
      .from("shop_items")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false });

  // Only active items for customers
    if (body.active_only !== false) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  }

  // ─── Add item ──────────────────────────────────────────
  if (action === "add_item") {
    const { data, error } = await supabase
      .from("shop_items")
      .insert({
        gym_id: gymId,
        name: body.name,
        description: body.description || null,
        price: body.price,
        image_url: body.image_url || null,
        category: body.category || "general",
        stock: body.stock ?? -1,
        is_active: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── Update item ───────────────────────────────────────
  if (action === "update_item") {
    const updates = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = body.price;
    if (body.image_url !== undefined) updates.image_url = body.image_url;
    if (body.category !== undefined) updates.category = body.category;
    if (body.stock !== undefined) updates.stock = body.stock;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("shop_items")
      .update(updates)
      .eq("id", body.item_id)
      .eq("gym_id", gymId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Delete item ───────────────────────────────────────
  if (action === "delete_item") {
    const { error } = await supabase
      .from("shop_items")
      .delete()
      .eq("id", body.item_id)
      .eq("gym_id", gymId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Process order (with points discount) ──────────────
  if (action === "place_order") {
    const { data, error } = await supabase.rpc("process_shop_order", {
      p_gym_id: gymId,
      p_member_id: body.member_id,
      p_items: body.items, // [{item_id, qty}]
      p_points_to_use: body.points_to_use || 0,
      p_processed_by: user?.id || null,
      p_processed_by_name: user?.name || null,
      p_notes: body.notes || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ data });
  }

  // ─── Get member's order history ────────────────────────
  if (action === "member_orders") {

    const { data, error } = await supabase
      .from("shop_orders")
      .select(`
        *,
        shop_order_items(
          *,
          shop_items(name, image_url)
        )
      `)
      .eq("member_id", body.member_id)
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(body.limit || 20);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  }

  // ─── Get all orders for gym (admin) ────────────────────
  if (action === "all_orders") {
    const { data, error } = await supabase
      .from("shop_orders")
      .select(`
        *,
        members(full_name, phone),
        shop_order_items(
          *,
          shop_items(name, image_url)
        )
      `)
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(body.limit || 50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, { allowBodyUserId: true });
