const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const newGym = {
    id: "49d01f48-303e-4074-a1de-54d03b2ad104",
    name: "Demo Gym",
    address: "123 Main St",
    timezone: "UTC",
    plan: "premium"
  };

  const { data, error } = await supabase
    .from("gyms")
    .insert([newGym])
    .select();

  if (error) {
    console.error("❌ Insert failed:", error.message);
  } else {
    console.log("✅ Insert succeeded:", data);
  }
}

testInsert();
