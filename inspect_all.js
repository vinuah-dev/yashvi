const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("--- Fetching all gyms ---");
  const { data: gyms, error: gymError } = await supabase.from("gyms").select("*");
  if (gymError) {
    console.error("Error gyms:", gymError);
  } else {
    console.table(gyms);
  }

  console.log("--- Fetching all profiles with gym_id ---");
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("*");
  if (profileError) {
    console.error("Error profiles:", profileError);
  } else {
    console.table(profiles.map(p => ({
      id: p.id,
      email: p.email,
      role: p.role,
      gym_id: p.gym_id,
      owner_id: p.owner_id
    })));
  }
}

inspect();
