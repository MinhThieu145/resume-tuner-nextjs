import { createClient } from "@supabase/supabase-js";

// Create a Supabase client with admin privileges (service role key)
// This bypasses Row Level Security (RLS) policies
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
