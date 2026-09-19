import { createClient } from "@supabase/supabase-js";

// SERVER-SIDE ONLY. Never import this file from a page/component that
// ships to the browser -- it uses the service role key which bypasses
// Row Level Security.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
