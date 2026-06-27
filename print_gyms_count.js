const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { count, error } = await supabase
    .from("gyms")
    .select("*", { count: 'exact', head: true });

  console.log("Error:", error);
  console.log("Count:", count);
}

test();
