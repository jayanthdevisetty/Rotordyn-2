import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wqgsqyvtugcnwahblpnn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_JvKg6k3uJyr1vnp-N-016g_H-S24esc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
