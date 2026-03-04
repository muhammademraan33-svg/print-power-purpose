import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Printify API token from conversation (truncated - full token should be in Supabase secrets)
const printifyApiKey = Deno.env.get('PRINTIFY_API_KEY') || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6IjA4ZDBkMjlhYWNkMjIzMzA0OGYxM2U0ZjczNGRhYjY4YjQ5ZGQ3ODdiNTM4ZjdiZDlmYjk0YzU4MzVhMmQ3ZTllNmQzM2Q2MGExNGJlZWRlIiwiaWF0IjoxNzcyNTE0Nzg0LjEzMTQ4OCwibmJmIjoxNzcyNTE0Nzg0LjEzMTQ5LCJleHAiOjE4MDQwNTA3ODQuMTI1MjM4LCJzdWIiOiIyMTI2NzU0NSIsInNjb3BlcyI6WyJzaG9wcy5tY...'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { orderId, shopId } = await req.json()

    if (!orderId || !shopId) {
      return new Response(JSON.stringify({ error: 'Order ID and Shop ID required' }), {
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

    // Prepare Printify order
    const printifyOrder = {
      external_id: order.order_number,
      label: `Print Power Purpose Order ${order.order_number}`,
      line_items: order.items
        .filter((item: any) => item.vendor === 'printify')
        .map((item: any) => ({
          product_id: item.vendorProductId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
        })),
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: {
        first_name: order.shipping_info?.first_name || '',
        last_name: order.shipping_info?.last_name || '',
        email: order.customer_email,
        phone: order.shipping_info?.phone || '',
        country: order.shipping_info?.country || 'US',
        region: order.shipping_info?.state || '',
        address1: order.shipping_info?.address_1 || '',
        city: order.shipping_info?.city || '',
        zip: order.shipping_info?.postcode || '',
      },
    }

    // Place order with Printify
    const response = await fetch(`https://api.printify.com/v1/shops/${shopId}/orders.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${printifyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(printifyOrder),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Printify order failed: ${error}`)
    }

    const printifyOrderResponse = await response.json()

    // Update order with Printify order ID
    await supabase
      .from('orders')
      .update({
        sinalite_order_id: `printify:${printifyOrderResponse.id}`,
        status: 'shipped',
      })
      .eq('id', orderId)

    return new Response(
      JSON.stringify({
        success: true,
        printifyOrderId: printifyOrderResponse.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Printify order error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to place Printify order' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
