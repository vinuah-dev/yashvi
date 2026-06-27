const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery(email) {
  console.log(`Testing query for: ${email}`);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .in("role", ["superadmin", "admin", "owner", "view_only"])
    .maybeSingle();

  if (profileError) {
    console.error("❌ Query Error:", profileError.message);
  } else if (!profile) {
    console.log("❌ Profile not found!");
  } else {
    console.log("✅ Profile found:", profile);
  }
}

async function runTests() {
  await testQuery("demo@gym.com");
  await testQuery("admin@basicirongym.com");
}

runTests();
