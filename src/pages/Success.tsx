import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, Heart, ShoppingBag, Package, ArrowRight } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { Order } from '@/types'

export default function Success() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', sessionId],
    queryFn: async () => {
      if (!sessionId) return null
      const { data, error } = await supabase
        .from('orders').select('*')
        .eq('session_id', sessionId).single()
      if (error) throw error
      return data as Order
    },
    enabled: !!sessionId,
  })

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your order…</p>
        </div>
      </div>
    )
  }

  // Order not found
  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center
                          mx-auto mb-6">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-8">
            We couldn't locate your order. Please contact support if you believe this is an error.
          </p>
          <Link to="/">
            <Button size="lg">Return Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-2xl">

        {/* Success card */}
        <div className="bg-white rounded-3xl border border-border/50 shadow-xl overflow-hidden">

          {/* Green header */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-12 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center
                            mx-auto mb-5 backdrop-blur-sm">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-2">Order Confirmed! 🎉</h1>
            <p className="text-emerald-100 text-lg">
              Thank you for your order and for giving back.
            </p>
          </div>

          {/* Body */}
          <div className="p-8">
            {/* Order details */}
            <div className="space-y-3 mb-8">
              <div className="flex justify-between py-2 border-b border-border/40 text-sm">
                <span className="text-muted-foreground">Order Number</span>
                <span className="font-semibold">{order.order_number}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/40 text-sm">
                <span className="text-muted-foreground">Order Total</span>
                <span className="font-semibold text-base">{formatPrice(order.amount_total_cents)}</span>
              </div>
              {order.donation_cents > 0 && (
                <div className="flex justify-between py-2 border-b border-border/40 text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    Donation
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {formatPrice(order.donation_cents)}
                  </span>
                </div>
              )}
            </div>

            {/* Donation cause */}
            {order.nonprofit_name && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center
                                  justify-center flex-shrink-0">
                    <Heart className="w-5 h-5 text-emerald-600 fill-current" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700 uppercase tracking-wide font-semibold mb-1">
                      Your Donation
                    </p>
                    <p className="font-bold text-emerald-900">{order.nonprofit_name}</p>
                    {order.cause_name && (
                      <p className="text-sm text-emerald-700">{order.cause_name}</p>
                    )}
                    <p className="text-sm text-emerald-800 font-semibold mt-1.5">
                      {formatPrice(order.donation_cents)} going directly to this organization.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Email confirmation */}
            <div className="bg-muted/40 rounded-xl p-4 mb-8 text-sm text-muted-foreground
                            text-center">
              A confirmation email will be sent to{' '}
              <span className="font-semibold text-foreground">{order.customer_email}</span>{' '}
              with your order details and tracking information.
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/products" className="flex-1">
                <Button variant="outline" className="w-full gap-2 border-2">
                  <ShoppingBag className="w-4 h-4" />
                  Continue Shopping
                </Button>
              </Link>
              <Link to="/" className="flex-1">
                <Button className="w-full gap-2">
                  Return Home <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Impact message */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            Thank you for making a difference with every print order. 💚
          </p>
        </div>
      </div>
    </div>
  )
}
