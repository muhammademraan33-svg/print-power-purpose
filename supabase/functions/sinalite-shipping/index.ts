import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { items, shippingInfo } = await req.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Items array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!shippingInfo || !shippingInfo.ShipState || !shippingInfo.ShipCountry || !shippingInfo.ShipZip) {
      return new Response(JSON.stringify({ error: 'Shipping info required (ShipState, ShipCountry, ShipZip)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await getSinaLiteToken()

    // Format items for SinaLite API
    const sinaliteItems = items.map((item: any) => ({
      productId: item.productId,
      options: Object.entries(item.options || {}).reduce((acc: Record<string, string>, [key, value]) => {
        acc[key] = String(value)
        return acc
      }, {}),
    }))

    // Get shipping estimate
    const response = await fetch(`${sinaliteApiUrl}/order/shippingEstimate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: sinaliteItems,
        shippingInfo: {
          ShipState: shippingInfo.ShipState,
          ShipCountry: shippingInfo.ShipCountry,
          ShipZip: shippingInfo.ShipZip,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SinaLite API error: ${error}`)
    }

    const data = await response.json()
    // Response format: { body: [[carrier, service, price, days], ...] }
    const shippingOptions = (data.body || []).map(([carrier, service, price, days]: [string, string, number, number]) => ({
      carrier,
      service,
      price,
      estimatedDays: days,
    }))

    return new Response(
      JSON.stringify({ body: data.body || [] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Shipping estimate error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get shipping estimate' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
