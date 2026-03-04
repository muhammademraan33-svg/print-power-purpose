import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let query = ''
    let limit = 50

    if (req.method === 'POST') {
      const body = await req.json()
      query = body.query || ''
      limit = body.limit || 50
    } else {
      const url = new URL(req.url)
      query = url.searchParams.get('q') || ''
      limit = parseInt(url.searchParams.get('limit') || '50')
    }

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ nonprofits: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Full-text search using PostgreSQL full-text search
    // First try full-text search if index exists
    const searchTerm = query.trim().toLowerCase()
    
    // Use full-text search with GIN index if available, otherwise fallback to ILIKE
    const { data, error } = await supabase.rpc('search_nonprofits_fts', {
      search_term: searchTerm,
      result_limit: limit,
    }).then(
      (result) => result,
      () => {
        // Fallback to ILIKE if RPC doesn't exist
        return supabase
          .from('nonprofits')
          .select('*')
          .or(`name.ilike.%${query}%,city.ilike.%${query}%,state.ilike.%${query}%,ein.ilike.%${query}%`)
          .eq('is_active', true)
          .limit(limit)
      }
    )

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ nonprofits: data || [] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Search error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Search failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
