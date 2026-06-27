import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";
import {
  getRequestUserId,
  resolveProfileContextById,
  resolveUserGymId,
} from "@/lib/server/tenantAuth";

/**
 * Wraps an API route handler with auth + tenant isolation.
 *
 * Usage:
 *   export const POST = withAuth(async (request, { user, gymId, supabase }) => {
 *     const body = await request.json();
 *     const { data, error } = await supabase.rpc("do_something", { p_gym_id: gymId });
 *     if (error) return NextResponse.json({ error: error.message }, { status: 500 });
 *     return NextResponse.json({ data });
 *   });
 *
 * Options:
 *   - requireAuth: true (default) — requires x-user-id header or p_user_id in body
 *   - requireGym: true (default) — resolves and validates gym_id
 *   - gymIdFromBody: "p_gym_id" (default) — which body field to read the requested gym_id from
 *   - allowBodyUserId: false (default) — if true, also checks body.p_user_id for auth
 */
export function withAuth(handler, options = {}) {
  const {
    requireAuth = true,
    requireGym = true,
    gymIdFromBody = "p_gym_id",
    allowBodyUserId = false,
  } = options;

  return async function wrappedHandler(request, routeContext) {
    try {
      const supabase = getSupabaseAdmin();

      // Clone the request so we can read the body multiple times if needed
      let body = null;
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json") && request.method !== "GET") {
        try {
          body = await request.json();
        } catch {
          body = {};
        }
      }

      let userId = getRequestUserId(request);

      // Some routes pass user_id in the body instead of headers
      if (!userId && allowBodyUserId && body?.p_user_id) {
        userId = String(body.p_user_id);
      }

      if (requireAuth && !userId) {
        return NextResponse.json(
          { error: "Missing authenticated user" },
          { status: 401 }
        );
      }

      let user = null;
      let gymId = null;
      const requestedGymId = request.headers.get("x-gym-id") || body?.[gymIdFromBody] || null;

      if (userId && requireGym) {
        // Try full profile context first (has name for audit trails)
        user = await resolveProfileContextById(supabase, userId);

        if (user) {
          gymId = user.gym_id;
        } else {
          // Fallback: resolve gym_id from members table (for customer users)
          gymId = await resolveUserGymId(supabase, userId);
        }

        if (!gymId && requestedGymId && user) {
          if (user.role === "superadmin") {
            const { data: gym } = await supabase
              .from("gyms")
              .select("id")
              .eq("id", requestedGymId)
              .maybeSingle();

            if (gym?.id) gymId = gym.id;
          } else if (user.role === "owner") {
            const { data: gym } = await supabase
              .from("gyms")
              .select("id")
              .eq("id", requestedGymId)
              .eq("owner_id", user.id)
              .maybeSingle();

            if (gym?.id) gymId = gym.id;
          }
        }

        if (!gymId) {
          return NextResponse.json(
            { error: "Unauthorized user" },
            { status: 403 }
          );
        }

        // Validate requested gym_id matches user's gym
        if (requestedGymId && requestedGymId !== gymId) {
          return NextResponse.json(
            { error: "Forbidden: gym access denied" },
            { status: 403 }
          );
        }
      } else if (userId) {
        user = await resolveProfileContextById(supabase, userId);
      }

      // Build the context object passed to the handler
      const ctx = {
        user: user || { id: userId },
        gymId,
        supabase,
        body,
      };

      return await handler(request, ctx, routeContext);
    } catch (err) {
      console.error("API error:", err);
      return NextResponse.json(
        { error: err.message || "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Lightweight wrapper for routes that only need the shared Supabase client
 * and basic error handling — no auth required.
 */
export function withApi(handler) {
  return async function wrappedHandler(request, routeContext) {
    try {
      const supabase = getSupabaseAdmin();
      return await handler(request, { supabase }, routeContext);
    } catch (err) {
      console.error("API error:", err);
      return NextResponse.json(
        { error: err.message || "Internal server error" },
        { status: 500 }
      );
    }
  };
}
