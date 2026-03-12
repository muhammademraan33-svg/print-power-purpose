import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// SinaLite API credentials (Sandbox/Test - from conversation)
const sinaliteClientId = Deno.env.get('SINALITE_CLIENT_ID_TEST') || Deno.env.get('SINALITE_CLIENT_ID_LIVE') || 'jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H'
const sinaliteClientSecret = Deno.env.get('SINALITE_CLIENT_SECRET_TEST') || Deno.env.get('SINALITE_CLIENT_SECRET_LIVE') || 'nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b'
const sinaliteAudience = Deno.env.get('SINALITE_AUDIENCE_TEST') || Deno.env.get('SINALITE_AUDIENCE_LIVE') || 'https://apiconnect.sinalite.com'
const sinaliteAuthUrl = Deno.env.get('SINALITE_AUTH_URL_TEST') || Deno.env.get('SINALITE_AUTH_URL_LIVE') || 'https://api.sinaliteuppy.com'
const sinaliteApiUrl = Deno.env.get('SINALITE_API_URL_TEST') || Deno.env.get('SINALITE_API_URL_LIVE') || 'https://api.sinaliteuppy.com'

let cachedToken: { token: string; expiresAt: number } | null = null

async function getSinaLiteToken(): Promise<string> {
  // Return cached token if still valid (with 60 second buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token
  }

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
  const expiresIn = (data.expires_in || 3600) * 1000
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn,
  }

  return data.access_token
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  try {
    const { action, productId, productOptions, qty, storeCode = 'en_ca' } = await req.json()

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const accessToken = await getSinaLiteToken()

    if (action === 'getOptions') {
      // Get product options
      const response = await fetch(`${sinaliteApiUrl}/product/${productId}/${storeCode}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`SinaLite API error: ${response.statusText}`)
      }

      const data = await response.json()
      // Response is array of arrays: [options, pricing, other]
      const options = Array.isArray(data) ? data[0] : data.options || []

      return new Response(
        JSON.stringify({ options }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    } else if (action === 'calculatePrice') {
      // Calculate price
      if (!productOptions || !Array.isArray(productOptions)) {
        return new Response(JSON.stringify({ error: 'Product options array required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }

      const response = await fetch(`${sinaliteApiUrl}/price/${productId}/${storeCode}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productOptions,
          ...(qty && { qty }),
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`SinaLite API error: ${error}`)
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
  } catch (error) {
    console.error('SinaLite price error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Failed to get price' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
