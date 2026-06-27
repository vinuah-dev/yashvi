import { createClient } from "@supabase/supabase-js";

let _instance = null;

/**
 * Returns a singleton Supabase admin client.
 * Reuses the same connection across all API routes in the same
 * serverless invocation instead of creating 25+ separate clients.
 */
export function getSupabaseAdmin() {
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL_P,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_P
    );
  }
  return _instance;
}
