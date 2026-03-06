import { createClient } from '@supabase/supabase-js'

// Project URL — safe to expose (it's public)
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://aogzhcbuuxyrcwjcvfkq.supabase.co'

// Anon key — for read-only / authenticated user operations
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Service-role key — used ONLY for storage uploads (bypasses RLS for the designs bucket)
// ⚠️  Move uploads to a Supabase Edge Function in production to keep this key server-side.
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseAnonKey) {
  console.warn(
    '⚠️  VITE_SUPABASE_ANON_KEY is not set. ' +
    'Add it in your Netlify / Vercel environment-variable settings. ' +
    'Supabase features (checkout, orders) will be unavailable until then.'
  )
}

// Standard anon client — for all read operations and auth
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'supabase-key-not-configured'
)

/** Admin client — ONLY used for storage uploads to the designs bucket.
 *  Uses service_role to bypass RLS; do NOT use for user-facing data queries. */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey || 'supabase-key-not-configured',
  { auth: { autoRefreshToken: false, persistSession: false } }
)
