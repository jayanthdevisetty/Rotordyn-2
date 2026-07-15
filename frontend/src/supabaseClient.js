import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error("Missing required environment variable: VITE_SUPABASE_URL. Application startup aborted to prevent accidental production connection fallback.");
}
if (!supabaseAnonKey) {
    throw new Error("Missing required environment variable: VITE_SUPABASE_ANON_KEY. Application startup aborted to prevent accidental production connection fallback.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
