/**
 * Supabase Client Configuration
 * Uses service role key for server-side operations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
dotenv.config();
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env'),
});
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env'),
  override: true,
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_URL environment variable');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

// Create Supabase client with service role key
// Service role key bypasses RLS for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Test connection on startup
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('biometric_attendance_logs')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
    return false;
  }
}
