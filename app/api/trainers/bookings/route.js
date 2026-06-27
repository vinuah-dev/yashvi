import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";
import { getRequestUserId, unauthorized } from "@/lib/server/tenantAuth";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

const supabaseAdmin = getSupabaseAdmin();

/**
 * GET /api/trainers/bookings?trainer_id=...&gym_id=...&day=...
 * Fetch booked slots for a trainer on a specific day
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const trainerId = searchParams.get("trainer_id");
    const gymId = searchParams.get("gym_id");
    const day = searchParams.get("day");

    if (!trainerId || !gymId) {
      return NextResponse.json(
        { error: "trainer_id and gym_id are required" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("trainer_bookings")
      .select("id, trainer_id, member_id, day, time_slot, created_at")
      .eq("trainer_id", trainerId)
      .eq("gym_id", gymId)
      .eq("is_active", true);

    if (day) {
      query = query.eq("day", day);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ bookings: data || [] });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trainers/bookings
 * Create a new trainer booking (shared slots allowed)
 *
 * Body: { trainer_id, member_id, gym_id, day, time_slot }
 */
export async function POST(request) {
  try {
    const currentUserId = getRequestUserId(request);
    if (!currentUserId) return unauthorized("Missing authenticated user");
    const writeBlocked = await blockViewOnlyWrites(request, supabaseAdmin, currentUserId);
    if (writeBlocked) return writeBlocked;

    const body = await request.json();
    const { trainer_id, member_id, gym_id, day, time_slot } = body;

    // Validate required fields
    if (!trainer_id || !member_id || !gym_id || !day || !time_slot) {
      return NextResponse.json(
        { error: "All fields are required: trainer_id, member_id, gym_id, day, time_slot" },
        { status: 400 }
      );
    }

    // 1. Prevent duplicate assignment of same member to same trainer/day/slot.
    const { data: existingBooking } = await supabaseAdmin
      .from("trainer_bookings")
      .select("id")
      .eq("trainer_id", trainer_id)
      .eq("member_id", member_id)
      .eq("gym_id", gym_id)
      .eq("day", day)
      .eq("time_slot", time_slot)
      .eq("is_active", true)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json(
        { error: "This member is already assigned to this slot" },
        { status: 409 }
      );
    }

    // 2. Deactivate any previous booking for this member at this gym
    await supabaseAdmin
      .from("trainer_bookings")
      .update({ is_active: false })
      .eq("member_id", member_id)
      .eq("gym_id", gym_id)
      .eq("is_active", true);

    // 3. Create the new booking
    const { data: booking, error: insertError } = await supabaseAdmin
      .from("trainer_bookings")
      .insert({
        trainer_id,
        member_id,
        gym_id,
        day,
        time_slot,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint violation (race condition)
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "This member is already assigned to that slot." },
          { status: 409 }
        );
      }
      throw insertError;
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    console.error("Error creating booking:", err);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trainers/bookings
 * Cancel a booking by ID or by member_id + gym_id
 *
 * Body: { booking_id } OR { member_id, gym_id }
 */
export async function DELETE(request) {
  try {
    const currentUserId = getRequestUserId(request);
    if (!currentUserId) return unauthorized("Missing authenticated user");
    const writeBlocked = await blockViewOnlyWrites(request, supabaseAdmin, currentUserId);
    if (writeBlocked) return writeBlocked;

    const body = await request.json();
    const { booking_id, member_id, gym_id } = body;

    if (booking_id) {
      const { error } = await supabaseAdmin
        .from("trainer_bookings")
        .update({ is_active: false })
        .eq("id", booking_id);

      if (error) throw error;
    } else if (member_id && gym_id) {
      const { error } = await supabaseAdmin
        .from("trainer_bookings")
        .update({ is_active: false })
        .eq("member_id", member_id)
        .eq("gym_id", gym_id)
        .eq("is_active", true);

      if (error) throw error;
    } else {
      return NextResponse.json(
        { error: "booking_id or (member_id + gym_id) required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error cancelling booking:", err);
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}
