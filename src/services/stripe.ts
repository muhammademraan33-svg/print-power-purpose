import { loadStripe } from '@stripe/stripe-js'

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!STRIPE_PUBLISHABLE_KEY) {
  console.warn('Stripe publishable key not configured')
}

export const stripePromise = STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null

export const stripeApi = {
  async createCheckoutSession(data: {
    items: Array<{
      id: string
      name: string
      priceCents: number
      quantity: number
      imageUrl?: string
    }>
    donationCents: number
    additionalDonationCents?: number
    causeId?: string
    causeName?: string
    nonprofitId?: string
    nonprofitName?: string
    nonprofitEin?: string
  }): Promise<{ sessionId: string; url: string }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Checkout session error: ${error}`)
    }

    return response.json()
  },
}
