import { useCart } from '@/contexts/CartContext'
import { useCause } from '@/contexts/CauseContext'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Trash2, Minus, Plus, ShoppingCart, Loader2,
  Heart, Shield, ChevronRight, ArrowRight, Package,
} from 'lucide-react'
import { formatPrice, calculateDonation } from '@/lib/utils'
import { stripeApi } from '@/services/stripe'
import { useState } from 'react'
import { toast } from '@/components/ui/toaster'
import DonationBarometer from '@/components/cart/DonationBarometer'

export default function Cart() {
  const { items, removeItem, updateQuantity, getTotal } = useCart()
  const { selectedCause, selectedNonprofit } = useCause()
  const navigate = useNavigate()
  const [isProcessing, setIsProcessing] = useState(false)
  const [additionalDonation, setAdditionalDonation] = useState(0)

  const totalCents       = getTotal()
  const donationCents    = calculateDonation(totalCents)
  const totalWithDonation = totalCents + donationCents + additionalDonation

  const handleCheckout = async () => {
    if (items.length === 0) { toast('Your cart is empty', 'error'); return }
    if (!selectedCause || !selectedNonprofit) {
      toast('Please select a cause before checkout', 'error')
      navigate('/causes')
      return
    }
    setIsProcessing(true)
    try {
      const session = await stripeApi.createCheckoutSession({
        items: items.map((item) => ({
          id: item.id, name: item.name, priceCents: item.priceCents,
          quantity: item.quantity, imageUrl: item.imageUrl,
        })),
        donationCents,
        additionalDonationCents: additionalDonation > 0 ? additionalDonation : undefined,
        causeId: selectedCause.id,
        causeName: selectedCause.name,
        nonprofitId: selectedNonprofit.id,
        nonprofitName: selectedNonprofit.name,
        nonprofitEin: selectedNonprofit.ein,
      })
      const stripe = await import('@stripe/stripe-js').then((m) =>
        m.loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!))
      if (stripe) await stripe.redirectToCheckout({ sessionId: session.sessionId })
    } catch (error) {
      console.error('Checkout error:', error)
      toast('Failed to start checkout. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center
                          mx-auto mb-6">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">
            Looks like you haven't added anything yet. Browse our print products to get started.
          </p>
          <Button size="lg" onClick={() => navigate('/products')} className="gap-2 px-8">
            Browse Products <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="bg-white border-b border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Shopping Cart</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Shopping Cart
            <span className="ml-3 text-base font-normal text-muted-foreground">
              ({items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8">

          {/* ── Cart Items ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.cartItemId}
                className="bg-white rounded-2xl border border-border/50 p-5 shadow-sm
                           hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted
                                  flex-shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=200&q=70'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-1 truncate">{item.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {formatPrice(item.priceCents)} each
                    </p>

                    {/* Controls row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Qty stepper */}
                      <div className="flex items-center rounded-xl border border-border overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-muted
                                     transition-colors border-r border-border"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-muted
                                     transition-colors border-l border-border"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.cartItemId)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground
                                   hover:text-destructive transition-colors ml-auto"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>

                      <span className="font-bold text-base ml-auto hidden sm:block">
                        {formatPrice(item.priceCents * item.quantity)}
                      </span>
                    </div>
                    {/* Mobile price */}
                    <p className="sm:hidden font-bold text-base mt-2">
                      {formatPrice(item.priceCents * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Continue shopping */}
            <Link to="/products"
              className="inline-flex items-center gap-2 text-sm text-primary font-medium
                         hover:gap-3 transition-all mt-2">
              ← Continue Shopping
            </Link>
          </div>

          {/* ── Order Summary ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-border/50 p-5 shadow-sm">
              <h2 className="font-bold text-lg mb-5">Order Summary</h2>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatPrice(totalCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    Auto Donation
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {formatPrice(donationCents)}
                  </span>
                </div>

                {/* Extra donation */}
                <div className="pt-3 mt-1 border-t border-border/40">
                  <label className="block text-sm font-semibold mb-2.5">
                    Additional Donation
                    <span className="ml-1 text-xs font-normal text-muted-foreground">(Optional)</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                    {[500, 1000, 2500, 5000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setAdditionalDonation(additionalDonation === amount ? 0 : amount)}
                        className={`text-xs py-2 rounded-lg border font-medium transition-all ${
                          additionalDonation === amount
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        ${amount / 100}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    placeholder="Custom $"
                    value={
                      additionalDonation > 0 && ![500, 1000, 2500, 5000].includes(additionalDonation)
                        ? additionalDonation / 100
                        : ''
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      setAdditionalDonation(val >= 1 ? Math.round(val * 100) : 0)
                    }}
                    className="h-9 text-sm"
                    min="1"
                  />
                  {additionalDonation > 0 && (
                    <div className="flex justify-between mt-2 text-sm text-emerald-700 font-medium">
                      <span>Additional Donation</span>
                      <span>{formatPrice(additionalDonation)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-base font-extrabold pt-3
                                border-t border-border">
                  <span>Total</span>
                  <span>{formatPrice(totalWithDonation)}</span>
                </div>
              </div>

              {/* Donation barometer */}
              <DonationBarometer
                totalCents={totalCents}
                donationCents={donationCents}
                causeName={selectedCause?.name || 'your cause'}
              />

              {/* Selected cause */}
              {selectedCause && selectedNonprofit ? (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">
                    Donating to
                  </p>
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center
                                    flex-shrink-0 mt-0.5">
                      <Heart className="w-4 h-4 text-rose-500 fill-current" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-snug">
                        {selectedNonprofit.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCause.name} · {selectedNonprofit.city}, {selectedNonprofit.state}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl
                                  border border-amber-200 mb-3">
                    <Heart className="w-4 h-4 text-amber-600" />
                    <p className="text-xs text-amber-700 font-medium">
                      Select a cause to complete checkout
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => navigate('/causes')}
                  >
                    <Heart className="w-4 h-4" />
                    Choose a Cause
                  </Button>
                </div>
              )}

              <Button
                size="lg"
                className="w-full mt-4 h-13 text-base font-semibold gap-2 shadow-md
                           shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5
                           transition-all"
                onClick={handleCheckout}
                disabled={isProcessing || !selectedCause || !selectedNonprofit}
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                ) : (
                  <>Proceed to Checkout <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </div>

            {/* Trust strip */}
            <div className="bg-white rounded-2xl border border-border/50 p-4 shadow-sm">
              <div className="flex flex-col gap-2">
                {[
                  { icon: Shield, text: 'SSL Encrypted Checkout' },
                  { icon: Heart,  text: '100% of donation reaches your cause' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
