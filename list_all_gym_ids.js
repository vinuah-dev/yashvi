const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkGyms() {
  console.log("--- Querying Gyms Table ---");
  const { data: gyms, error: gymError } = await supabase
    .from("gyms")
    .select("id, name");

  if (gymError) {
    console.error("❌ Gyms query error:", gymError.message);
  } else {
    console.log("Gyms in gyms table:", gyms);
  }

  console.log("\n--- Querying Unique gym_ids referenced in Profiles Table ---");
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("gym_id, email, role");

  if (profileError) {
    console.error("❌ Profiles query error:", profileError.message);
  } else {
    const referencedGyms = {};
    profiles.forEach(p => {
      if (p.gym_id) {
        if (!referencedGyms[p.gym_id]) {
          referencedGyms[p.gym_id] = [];
        }
        referencedGyms[p.gym_id].push(`${p.email || 'No Email'} (${p.role})`);
      }
    });
    console.log("Referenced Gym IDs and users linked to them:", referencedGyms);
  }
}

checkGyms();
