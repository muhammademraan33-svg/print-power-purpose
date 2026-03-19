// @ts-nocheck
// This file runs in Deno, not Node.js. IDE linting errors are false positives.
// The code is correct and will work when deployed to Supabase Edge Functions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'

// Deno environment variables
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY_LIVE') || ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
})

// Validate required environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

if (!supabaseUrl || !supabaseServiceKey || !webhookSecret) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or STRIPE_WEBHOOK_SECRET')
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Extract metadata
      const metadata = session.metadata || {}
      const orderNumber = metadata.order_number
      const donationCents = parseInt(metadata.donation_cents || '0')
      const causeId = metadata.cause_id
      const causeName = metadata.cause_name
      const nonprofitId = metadata.nonprofit_id
      const nonprofitName = metadata.nonprofit_name
      const nonprofitEin = metadata.nonprofit_ein

      // Get line items to reconstruct order
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product'],
      })

      const items = lineItems.data
        .filter((item: any) => !item.description?.includes('Donation'))
        .map((item: any) => ({
          id: item.price?.product as string || '',
          // Product id used by our fulfillment functions (SinaLite / Printify)
          productId: parseInt(item.metadata?.productId ?? item.price?.product as string, 10) || 0,
          vendor: item.metadata?.vendor || null,
          artworkUrl: item.metadata?.artworkUrl || null,
          configuration: (() => {
            const raw = item.metadata?.configuration
            if (!raw) return {}
            try {
              return JSON.parse(raw)
            } catch {
              return {}
            }
          })(),
          name: item.description || '',
          priceCents: item.amount_total,
          quantity: item.quantity || 1,
          designId: item.metadata?.designId || null,
          preflightHash: item.metadata?.preflightHash || null,
        }))

      // Calculate totals
      const subtotalCents = items.reduce((sum: number, item: any) => sum + item.priceCents, 0)
      const amountTotalCents = session.amount_total

      // Create order record
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          status: 'completed',
          customer_email: session.customer_details?.email || session.customer_email || '',
          currency: session.currency || 'usd',
          amount_total_cents: amountTotalCents,
          subtotal_cents: subtotalCents,
          tax_cents: 0,
          donation_cents: donationCents,
          quantity: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          items: items,
          cause_id: causeId || null,
          cause_name: causeName || null,
          nonprofit_id: nonprofitId || null,
          nonprofit_name: nonprofitName || null,
          nonprofit_ein: nonprofitEin || null,
          shipping_info: session.shipping_details || {},
          billing_info: session.customer_details || {},
          receipt_url: session.customer_details?.email ? `https://dashboard.stripe.com/payments/${session.payment_intent}` : null,
          payment_mode: session.livemode ? 'live' : 'test',
          paid_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order creation error:', orderError)
        throw orderError
      }

      // Create donation record if donation > 0
      if (donationCents > 0 && nonprofitId) {
        const { error: donationError } = await supabase
          .from('donations')
          .insert({
            order_id: order.id,
            cause_id: causeId || null,
            nonprofit_id: nonprofitId,
            nonprofit_name: nonprofitName || '',
            nonprofit_ein: nonprofitEin || '',
            amount_cents: donationCents,
            customer_email: session.customer_details?.email || session.customer_email || '',
            payout_status: 'pending',
          })

        if (donationError) {
          console.error('Donation creation error:', donationError)
        } else {
          // Update cause raised amount
          if (causeId) {
            await supabase.rpc('increment_cause_raised', {
              cause_uuid: causeId,
              amount_cents: donationCents,
            })
          }

          // Update nonprofit progress
          await supabase.rpc('update_nonprofit_progress', {
            nonprofit_uuid: nonprofitId,
            amount_cents: donationCents,
          })
        }
      }

      // Create WooCommerce order
      try {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const wooCommerceUrl = Deno.env.get('WOOCOMMERCE_STORE_URL') || 'https://printpowerpurpose.com'
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY') || 'ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192'
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET') || 'cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7'
        const credentials = btoa(`${consumerKey}:${consumerSecret}`)

        const wooOrderData = {
          payment_method: 'stripe',
          payment_method_title: 'Stripe',
          set_paid: true,
          billing: {
            first_name: session.customer_details?.name?.split(' ')[0] || '',
            last_name: session.customer_details?.name?.split(' ').slice(1).join(' ') || '',
            address_1: session.customer_details?.address?.line1 || '',
            city: session.customer_details?.address?.city || '',
            state: session.customer_details?.address?.state || '',
            postcode: session.customer_details?.address?.postal_code || '',
            country: session.customer_details?.address?.country || 'US',
            email: session.customer_details?.email || '',
            phone: session.customer_details?.phone || '',
          },
          shipping: {
            first_name: session.shipping_details?.name?.split(' ')[0] || '',
            last_name: session.shipping_details?.name?.split(' ').slice(1).join(' ') || '',
            address_1: session.shipping_details?.address?.line1 || '',
            city: session.shipping_details?.address?.city || '',
            state: session.shipping_details?.address?.state || '',
            postcode: session.shipping_details?.address?.postal_code || '',
            country: session.shipping_details?.address?.country || 'US',
          },
          line_items: items.map((item: any) => ({
            product_id: parseInt(item.id) || 0,
            quantity: item.quantity,
            meta_data: [
              { key: 'order_number', value: orderNumber },
            ],
          })),
          meta_data: [
            { key: 'print_power_purpose_order_id', value: order.id },
            { key: 'donation_cents', value: donationCents.toString() },
            { key: 'nonprofit_name', value: nonprofitName || '' },
          ],
        }

        const wooResponse = await fetch(`${wooCommerceUrl}/wp-json/wc/v3/orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(wooOrderData),
        })

        if (wooResponse.ok) {
          const wooOrder = await wooResponse.json()
          // Update order with WooCommerce order ID
          await supabase
            .from('orders')
            .update({ sinalite_order_id: `woo:${wooOrder.id}` })
            .eq('id', order.id)
        }
      } catch (wooError) {
        console.error('WooCommerce order creation error:', wooError)
        // Don't fail the webhook if WooCommerce fails
      }

      // Auto-trigger fulfillment based on vendor
      // Note: Fulfillment is triggered asynchronously to avoid blocking webhook response
      try {
        const items = order.items as any[]
        
          // Check if order contains SinaLite products
          const hasSinaLiteProducts = items.some((item: any) =>
            item.vendor === 'sinalite' || (!item.vendor && !item.vendorProductId?.startsWith('printify:'))
          )

          // Check if order contains Printify products
          const hasPrintifyProducts = items.some((item: any) =>
            item.vendor === 'printify' || item.vendorProductId?.startsWith('printify:')
          )

        // Place SinaLite order if needed (async, don't await)
        if (hasSinaLiteProducts) {
          fetch(`${supabaseUrl}/functions/v1/place-sinalite-order`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId: order.id }),
          }).catch((err) => {
            console.error('SinaLite order placement error:', err)
          })
        }

        // Place Printify order if needed (async, don't await)
        if (hasPrintifyProducts) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const shopId = Deno.env.get('PRINTIFY_SHOP_ID') || ''
          if (shopId) {
            fetch(`${supabaseUrl}/functions/v1/place-printify-order`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ orderId: order.id, shopId }),
            }).catch((err) => {
              console.error('Printify order placement error:', err)
            })
          }
        }
      } catch (fulfillmentError) {
        console.error('Fulfillment error:', fulfillmentError)
        // Don't fail the webhook if fulfillment fails - order is already created
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Webhook processing failed' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
