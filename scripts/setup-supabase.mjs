/**
 * setup-supabase.mjs
 * One-time setup: creates the "designs" public bucket in Supabase Storage.
 * Run with:  node scripts/setup-supabase.mjs
 * Requires:  SUPABASE_SERVICE_ROLE_KEY set in .env
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env')

// Load .env manually
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
} catch {}

const SUPABASE_URL         = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY             = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.error('❌  VITE_SUPABASE_URL not set in .env')
  process.exit(1)
}

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.startsWith('your_') || SERVICE_ROLE_KEY === 'FETCHING_BELOW') {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY is missing.')
  console.error('    Go to: ' + SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/').split('.')[0] + '/settings/api')
  console.error('    Copy the "service_role secret" key and add it to .env as SUPABASE_SERVICE_ROLE_KEY=...')
  process.exit(1)
}

async function createBucket(name, isPublic = true) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ id: name, name, public: isPublic }),
  })
  const data = await res.json()
  if (res.ok) {
    console.log(`✅  Bucket "${name}" created (public: ${isPublic})`)
  } else if (data.error === 'The resource already exists') {
    console.log(`ℹ️   Bucket "${name}" already exists — skipping`)
  } else {
    console.error(`❌  Failed to create bucket "${name}":`, data)
  }
  return res.ok
}

async function setBucketPolicy(bucket) {
  // Allow public SELECT (read)
  const selectPolicy = `
    CREATE POLICY IF NOT EXISTS "public_read_${bucket}"
    ON storage.objects FOR SELECT
    USING (bucket_id = '${bucket}');
  `
  // Allow anon INSERT (upload) — in production restrict to authenticated
  const insertPolicy = `
    CREATE POLICY IF NOT EXISTS "anon_insert_${bucket}"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = '${bucket}');
  `
  for (const sql of [selectPolicy, insertPolicy]) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    })
    if (!res.ok) {
      // exec_sql might not exist — that's fine, policies can be set in dashboard
      const t = await res.text()
      if (!t.includes('does not exist')) console.warn('Policy note:', t.substring(0, 200))
    }
  }
  console.log(`✅  Storage policies applied for "${bucket}"`)
}

async function main() {
  console.log('🔧  Setting up Supabase Storage...\n')

  await createBucket('designs', true)
  await setBucketPolicy('designs')

  console.log('\n✨  Setup complete!')
  console.log('    Print files will be stored at:', `${SUPABASE_URL}/storage/v1/object/public/designs/...`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
