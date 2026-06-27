const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://hbhumkwhlwmbwoxnyvms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiaHVta3dobHdtYndveG55dm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTM5ODYsImV4cCI6MjA5Mzk2OTk4Nn0.Wa654n3YkLPxaaMLYoDZZ2XV-JZUJ7vl1CQsptyit94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  const ids = [
    'ff03a3a0-4582-433f-982f-de6d3df9650e',
    '49d01f48-303e-4074-a1de-54d03b2ad104',
    '06b83c32-43fa-4338-9cb6-df8c965bd7df',
    '9fd33e89-535b-44d7-9345-17d278a14490',
    'b03b0d14-6cc9-4ce1-89b9-b2027958e929',
    '37f82e1b-d09b-4b77-8f4e-23ed0b211dfd'
  ];

  for (const id of ids) {
    const { data, error } = await supabase
      .from("gyms")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(`Error for gym ${id}:`, error.message);
    } else {
      console.log(`Gym ${id}:`, data);
    }
  }
}

inspect();
