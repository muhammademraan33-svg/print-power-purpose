import { createClient } from '@supabase/supabase-js'

// Hardcoded project URL — safe to expose (it's public)
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://cdglodnhpopswiodxizy.supabase.co'

// Anon key — must be set in your hosting platform's env vars (Netlify / Vercel dashboard)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseAnonKey) {
  console.warn(
    '⚠️  VITE_SUPABASE_ANON_KEY is not set. ' +
    'Add it in your Netlify / Vercel environment-variable settings. ' +
    'Supabase features (checkout, orders) will be unavailable until then.'
  )
}

// createClient does NOT throw on empty strings; requests simply return 401.
// Using a placeholder keeps the app loading even before the key is configured.
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'supabase-key-not-configured'
)
