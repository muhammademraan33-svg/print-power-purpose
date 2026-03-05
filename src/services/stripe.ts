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
      /** URL of the finalized print-ready file — sent to SinaLite /order/new */
      artworkUrl?: string
      /** Design session ID used by the backend /finalize endpoint */
      designId?: string
      /** Hash to verify design hasn't changed since preflight */
      preflightHash?: string
      /** Selected product options (size, paper, finish, etc.) */
      configuration?: Record<string, any>
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
