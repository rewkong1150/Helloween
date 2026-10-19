import { createClient } from '@supabase/supabase-js';

// The URL and publishable key are public by design (they ship in every web build).
// Access is enforced by the row-level security policies in supabase/schema.sql.
const SUPABASE_URL = 'https://paxsksbabtoznakdbxcb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_tHvTc_r4RZarJlSag6o29w_XkoXcpgb';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

export const MEDIA_BUCKET = 'entries';
