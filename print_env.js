console.log("SERVICE ROLE KEY EXISTS:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Length:", process.env.SUPABASE_SERVICE_ROLE_KEY.length);
}
