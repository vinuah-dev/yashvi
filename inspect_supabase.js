const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("Checking profiles table...");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, phone, role, password, is_active");

  if (error) {
    console.error("❌ Error fetching profiles:", error.message);
    console.log("This usually means Row Level Security (RLS) is active and blocking anonymous reads.");
  } else {
    console.log("✅ Successfully retrieved profiles:");
    console.table(
      profiles.map(p => ({
        id: p.id,
        email: p.email,
        phone: p.phone,
        role: p.role,
        password: p.password,
        password_type: typeof p.password,
        is_active: p.is_active
      }))
    );
  }
}

inspect();
