const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'gymadmin@gmail.com',
    password: 'Admin123'
  });

  if (authError) {
    console.error("❌ Auth Error:", authError.message);
    return;
  }

  console.log("✅ Authenticated successfully! User ID:", authData.user.id);

  console.log("Querying profiles...");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError) {
    console.error("❌ Profile Error:", profileError.message);
  } else {
    console.log("Profile Data:", profile);
  }

  console.log("Querying gyms...");
  const { data: gyms, error: gymError } = await supabase
    .from("gyms")
    .select("*");

  if (gymError) {
    console.error("❌ Gyms Query Error:", gymError.message);
  } else {
    console.log("Gyms found in DB:", gyms);
  }
}

test();
