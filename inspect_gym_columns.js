const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectColumns() {
  const { error: selectError } = await supabase
    .from("gyms")
    .select("id, name, address, timezone, owner_id, plan_type, logo_url")
    .limit(1);

  if (selectError) {
    console.log("❌ Select error message:", selectError.message);
  } else {
    console.log("✅ Columns exist!");
  }
}

inspectColumns();
