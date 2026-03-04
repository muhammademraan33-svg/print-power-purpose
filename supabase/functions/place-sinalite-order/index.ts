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
    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get access token
    const accessToken = await getSinaLiteToken()

    // Prepare SinaLite order
    // Note: This is a simplified version - you'll need to map WooCommerce products to SinaLite products
    const sinaliteOrder = {
      items: order.items.map((item: any) => ({
        productId: item.vendorProductId || item.productId, // Map to SinaLite product ID
        options: item.configuration || {},
        files: item.artworkUrl ? [{ type: 'pdf', url: item.artworkUrl }] : [],
      })),
      shippingInfo: {
        ShipFName: order.shipping_info?.first_name || '',
        ShipLName: order.shipping_info?.last_name || '',
        ShipEmail: order.customer_email,
        ShipAddr: order.shipping_info?.address_1 || '',
        ShipAddr2: order.shipping_info?.address_2 || '',
        ShipCity: order.shipping_info?.city || '',
        ShipState: order.shipping_info?.state || '',
        ShipZip: order.shipping_info?.postcode || '',
        ShipCountry: order.shipping_info?.country || 'US',
        ShipPhone: order.shipping_info?.phone || '',
        ShipMethod: 'standard',
      },
      billingInfo: {
        BillFName: order.billing_info?.first_name || '',
        BillLName: order.billing_info?.last_name || '',
        BillEmail: order.customer_email,
        BillAddr: order.billing_info?.address_1 || '',
        BillAddr2: order.billing_info?.address_2 || '',
        BillCity: order.billing_info?.city || '',
        BillState: order.billing_info?.state || '',
        BillZip: order.billing_info?.postcode || '',
        BillCountry: order.billing_info?.country || 'US',
        BillPhone: order.billing_info?.phone || '',
      },
      notes: `Order ${order.order_number} - Donation: $${(order.donation_cents / 100).toFixed(2)} to ${order.nonprofit_name || 'chosen cause'}`,
    }

    // Place order with SinaLite
    const response = await fetch(`${sinaliteApiUrl}/order/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sinaliteOrder),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SinaLite order failed: ${error}`)
    }

    const sinaliteOrderResponse = await response.json()

    // Update order with SinaLite order ID
    await supabase
      .from('orders')
      .update({
        sinalite_order_id: sinaliteOrderResponse.id || sinaliteOrderResponse.order_id,
        status: 'shipped', // Update status
      })
      .eq('id', orderId)

    return new Response(
      JSON.stringify({
        success: true,
        sinaliteOrderId: sinaliteOrderResponse.id || sinaliteOrderResponse.order_id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('SinaLite order error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to place SinaLite order' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
