import { createClient } from "@supabase/supabase-js";


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: members, error: mError } = await supabaseAdmin
    .from("members")
    .select("id, full_name, phone, email, gym_id, created_at, gyms(plan_type)")
    .gte("created_at", "2026-05-16T15:00:00+00:00")
    .order("created_at", { ascending: false });
    
  console.log("Members:", members);

  if (members && members.length > 0) {
    const { data: creds, error: cError } = await supabaseAdmin
      .from("member_credentials")
      .select("*")
      .in("member_id", members.map(m => m.id));
      
    console.log("Their Credentials:", creds);
  }
}

check();
