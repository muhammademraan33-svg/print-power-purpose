import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY_LIVE') || '', {
  apiVersion: '2023-10-16',
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const {
      items,
      donationCents,
      additionalDonationCents,
      causeId,
      causeName,
      nonprofitId,
      nonprofitName,
      nonprofitEin,
    } = await req.json()

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Calculate totals
    const subtotalCents = items.reduce((sum: number, item: any) => sum + item.priceCents * item.quantity, 0)
    const totalDonationCents = donationCents + (additionalDonationCents || 0)
    const totalCents = subtotalCents + totalDonationCents

    // Create Stripe line items
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.imageUrl ? [item.imageUrl] : undefined,
        },
        unit_amount: item.priceCents,
      },
      quantity: item.quantity,
      // Important: Stripe line-item metadata must contain everything we need later to
      // build the SinaLite / Printify payload (final artwork URL + selected options).
      metadata: {
        productId: String(item.productId ?? ''),
        vendor: String(item.vendor ?? ''),
        artworkUrl: String(item.artworkUrl ?? ''),
        configuration: JSON.stringify(item.configuration ?? {}),
        designId: String(item.designId ?? ''),
        preflightHash: String(item.preflightHash ?? ''),
      },
    }))

    // Add donation as separate line item if > 0
    if (totalDonationCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Donation to ${nonprofitName || 'your chosen cause'}`,
          },
          unit_amount: totalDonationCents,
        },
        quantity: 1,
      })
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.get('origin') || 'http://localhost:5173'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin') || 'http://localhost:5173'}/cart`,
      metadata: {
        order_number: orderNumber,
        item_count: items.length.toString(),
        donation_cents: totalDonationCents.toString(),
        cause_id: causeId || '',
        cause_name: causeName || '',
        nonprofit_id: nonprofitId || '',
        nonprofit_name: nonprofitName || '',
        nonprofit_ein: nonprofitEin || '',
      },
    })

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Checkout session error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create checkout session' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
