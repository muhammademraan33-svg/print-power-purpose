import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// SinaLite API credentials (Sandbox/Test - from conversation)
const sinaliteClientId = Deno.env.get('SINALITE_CLIENT_ID_TEST') || Deno.env.get('SINALITE_CLIENT_ID_LIVE') || 'jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H'
const sinaliteClientSecret = Deno.env.get('SINALITE_CLIENT_SECRET_TEST') || Deno.env.get('SINALITE_CLIENT_SECRET_LIVE') || 'nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b'
const sinaliteAudience = Deno.env.get('SINALITE_AUDIENCE_TEST') || Deno.env.get('SINALITE_AUDIENCE_LIVE') || 'https://apiconnect.sinalite.com'
const sinaliteAuthUrl = Deno.env.get('SINALITE_AUTH_URL_TEST') || Deno.env.get('SINALITE_AUTH_URL_LIVE') || 'https://api.sinaliteuppy.com'
const sinaliteApiUrl = Deno.env.get('SINALITE_API_URL_TEST') || Deno.env.get('SINALITE_API_URL_LIVE') || 'https://api.sinaliteuppy.com'

async function getSinaLiteToken(): Promise<string> {
  const response = await fetch(`${sinaliteAuthUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: sinaliteClientId,
      client_secret: sinaliteClientSecret,
      audience: sinaliteAudience,
    }),
  })

  if (!response.ok) {
    throw new Error(`SinaLite auth failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const accessToken = await getSinaLiteToken()

    // Fetch all products from SinaLite API
    const response = await fetch(`${sinaliteApiUrl}/product`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`SinaLite API error: ${response.statusText}`)
    }

    const products: Array<{
      id: number
      sku: string
      name: string
      category: string
      enabled: number
    }> = await response.json()

    // Filter only enabled products
    const activeProducts = products.filter(p => p.enabled === 1)

    // Upsert products into database
    const results = []
    for (const product of activeProducts) {
      const { data, error } = await supabase
        .from('products')
        .upsert({
          vendor: 'sinalite',
          vendor_product_id: product.id.toString(),
          name: product.name,
          category: product.category,
          sku: product.sku,
          is_active: true,
          metadata: product,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'vendor,vendor_product_id',
        })
        .select()
        .single()

      if (error) {
        console.error(`Error upserting product ${product.name}:`, error)
      } else {
        results.push({ id: data.id, name: product.name })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: activeProducts.length,
        synced: results.length,
        products: results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to sync products' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
