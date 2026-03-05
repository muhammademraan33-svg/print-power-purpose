import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useCart } from '@/contexts/CartContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, AlertTriangle, Package, ChevronRight, ShoppingCart,
  Check, Minus, Plus, Shield, Truck, Heart,
} from 'lucide-react'
import { formatPrice, calculateDonation } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import ProductDesigner from '@/components/product/ProductDesigner'
import sinaliteData from '@/data/sinaliteProducts.json'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SinaliteOption       { id: number; group: string; name: string; hidden: number }
interface SinaliteOptionGroup  { name: string; values: string[] }

const SINALITE_CLIENT_ID     = import.meta.env.VITE_SINALITE_CLIENT_ID     || 'jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H'
const SINALITE_CLIENT_SECRET = import.meta.env.VITE_SINALITE_CLIENT_SECRET || 'nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b'
const SINALITE_AUDIENCE      = import.meta.env.VITE_SINALITE_AUDIENCE      || 'https://apiconnect.sinalite.com'

async function getSinaLiteToken(): Promise<string> {
  const res = await fetch('/sinalite-auth/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: SINALITE_CLIENT_ID,
      client_secret: SINALITE_CLIENT_SECRET, audience: SINALITE_AUDIENCE }),
  })
  if (!res.ok) throw new Error('Failed to get SinaLite token')
  const data = await res.json()
  return data.access_token
}

async function fetchSinaLiteOptions(productId: string | number): Promise<SinaliteOptionGroup[]> {
  const token = await getSinaLiteToken()
  const res = await fetch(`/sinalite-api/product/${productId}/option`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  const options: SinaliteOption[] = Array.isArray(data[0]) ? data[0] : (Array.isArray(data) ? data : [])
  const grouped: Record<string, string[]> = {}
  for (const opt of options) {
    if (!opt.group || opt.hidden) continue
    if (!grouped[opt.group]) grouped[opt.group] = []
    grouped[opt.group].push(opt.name)
  }
  return Object.entries(grouped).map(([name, values]) => ({ name, values }))
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const source    = searchParams.get('source') || 'sinalite'
  const navigate  = useNavigate()
  const { addItem } = useCart()

  const [quantity, setQuantity]           = useState(1)
  const [artworkUrl, setArtworkUrl]       = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  const localProducts = (sinaliteData as any).products as any[]
  const localProduct  = localProducts.find((p: any) => String(p.id) === String(id))

  // Options stored in JSON (populated by npm run sync:products)
  const localOptions: SinaliteOptionGroup[] =
    Array.isArray(localProduct?.options) ? localProduct.options : []

  // Only hit the live API when local options are absent (dev proxy required)
  const { data: apiOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['product-options', id, source],
    queryFn:  () => fetchSinaLiteOptions(id!),
    enabled:  !!id && source === 'sinalite' && localOptions.length === 0,
  })

  const optionGroups = localOptions.length > 0 ? localOptions : apiOptions

  // Derive selected size for the canvas ratio
  const selectedSizeValue: string | undefined = (() => {
    const sizeKey = Object.keys(selectedOptions).find(k => k.toLowerCase().includes('size'))
    return sizeKey ? selectedOptions[sizeKey] : undefined
  })()

  const handleAddToCart = () => {
    if (!localProduct) return
    addItem({
      id:           localProduct.id.toString(),
      productId:    typeof localProduct.id === 'number' ? localProduct.id : 0,
      name:         localProduct.name,
      priceCents:   5000,
      quantity,
      imageUrl:     localProduct.image || undefined,
      configuration: selectedOptions,
      artworkUrl:   artworkUrl || undefined,
      vendor:       source as 'sinalite' | 'printify' | 'woocommerce',
    })
    toast('Added to cart!', 'success')
    navigate('/cart')
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!localProduct) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
          <Package className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Product not found</h2>
        <p className="text-muted-foreground mb-6">This product doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/products')}>← Back to Products</Button>
      </div>
    )
  }

  const donationCents = calculateDonation(5000 * quantity)

  // ─── Reusable "right column" content blocks ────────────────────────────────
  // Defined once and rendered in two different orders depending on screen size.

  const TitleBlock = (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant="secondary" className="capitalize">{localProduct.category}</Badge>
        {source === 'printify' && (
          <Badge className="bg-purple-100 text-purple-700 border border-purple-200">Apparel</Badge>
        )}
      </div>
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-3 leading-tight">
        {localProduct.name}
      </h1>
      {localProduct.description && (
        <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
          {localProduct.description.replace(/<[^>]*>/g, '')}
        </p>
      )}
    </div>
  )

  const SpecsBlock = (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-800 text-sm mb-1.5">Artwork Specifications</h4>
          <ul className="text-xs text-amber-700 space-y-1">
            <li>• PDF format preferred (AI, EPS, TIFF accepted)</li>
            <li>• 300 DPI resolution · CMYK color mode</li>
            <li>• 0.125" bleed on all edges</li>
            <li>• Keep text 0.25" from trim edge</li>
          </ul>
        </div>
      </div>
    </div>
  )

  const OptionsBlock = source === 'sinalite' ? (
    <div className="bg-white rounded-2xl border border-border/50 p-4 sm:p-5 shadow-sm">
      <h3 className="font-semibold mb-4 text-base">Product Options</h3>
      {optionsLoading && localOptions.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading options…
        </div>
      ) : optionGroups && optionGroups.length > 0 ? (
        <div className="space-y-4">
          {optionGroups.map((group) => (
            <div key={group.name}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-foreground">{group.name}</label>
                {selectedOptions[group.name] && (
                  <span className="text-xs text-primary font-medium">
                    {selectedOptions[group.name]}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.values.map((val) => (
                  <button
                    key={val}
                    onClick={() => setSelectedOptions(prev => ({ ...prev, [group.name]: val }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      selectedOptions[group.name] === val
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background border-border text-foreground/80 hover:border-primary/50'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Options will be confirmed at checkout.</p>
      )}
    </div>
  ) : null

  const QtyCartBlock = (
    <div className="bg-white rounded-2xl border border-border/50 p-4 sm:p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-base">Quantity & Pricing</h3>

      {/* Qty stepper */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-20">Quantity</label>
        <div className="flex items-center rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors border-r border-border"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <Input
            type="number" min="1" value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center border-0 rounded-none h-10 focus-visible:ring-0 font-semibold"
          />
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors border-l border-border"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Price rows */}
      <div className="space-y-2 pt-3 border-t border-border/40">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Unit Price</span>
          <span className="font-medium italic text-muted-foreground">Calculated at checkout</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-400" /> Auto Donation (est.)
          </span>
          <span className="font-semibold text-emerald-600">~{formatPrice(donationCents)}</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-2 border-t border-border/40">
          <span>Qty</span>
          <span>× {quantity}</span>
        </div>
      </div>

      {/* Add to cart — desktop / tablet only (mobile uses sticky bar below) */}
      <Button
        size="lg"
        className="hidden sm:flex w-full h-14 text-base font-semibold gap-3 shadow-lg
                   shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
        onClick={handleAddToCart}
      >
        <ShoppingCart className="w-5 h-5" /> Add to Cart
      </Button>
      <p className="hidden sm:block text-xs text-muted-foreground text-center">
        Final price calculated based on your selected options and quantity.
      </p>

      {/* Trust pills */}
      <div className="flex flex-wrap gap-3 pt-1">
        {[
          { icon: Shield, text: 'Secure Checkout' },
          { icon: Truck,  text: 'Fast Shipping'   },
          { icon: Check,  text: 'Quality Guarantee' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="w-3.5 h-3.5 text-primary" /> {text}
          </div>
        ))}
      </div>
    </div>
  )

  // ─── Page ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* Breadcrumb */}
      <div className="border-b border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
            <Link to="/" className="hover:text-foreground transition-colors shrink-0">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link to="/products" className="hover:text-foreground transition-colors shrink-0">Products</Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-foreground font-medium truncate">{localProduct.name}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12
                      pb-24 sm:pb-6">  {/* pb-24 on mobile = space for sticky CTA */}

        {/* ── MOBILE LAYOUT: single column, natural reading order ──────────── */}
        {/* Title → Options (pick size first) → Image → Designer → Qty        */}
        {/* ── DESKTOP LAYOUT: 2-column grid (left = image+designer, right = info) */}

        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-12 xl:gap-16 gap-5">

          {/* ═══ RIGHT COLUMN content — appears FIRST on mobile ═══════════ */}
          <div className="order-1 lg:order-2 space-y-5">

            {/* Title */}
            {TitleBlock}

            {/* Artwork specs */}
            {SpecsBlock}

            {/* Options */}
            {OptionsBlock}

            {/* Qty + Cart (hidden on small mobile — shown in sticky bar) */}
            {QtyCartBlock}
          </div>

          {/* ═══ LEFT COLUMN content — appears SECOND on mobile ══════════ */}
          <div className="order-2 lg:order-1 space-y-5">

            {/* Product image */}
            <div className="rounded-2xl sm:rounded-3xl overflow-hidden bg-muted
                            aspect-[4/3] sm:aspect-[3/2] lg:aspect-square
                            shadow-lg border border-border/30">
              {localProduct.image ? (
                <img
                  src={localProduct.image}
                  alt={localProduct.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&q=80'
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <Package className="h-16 w-16 text-muted-foreground/30" />
                  <span className="text-sm text-muted-foreground">No image available</span>
                </div>
              )}
            </div>

            {/* Designer */}
            <ProductDesigner
              productId={typeof localProduct.id === 'number' ? localProduct.id : 0}
              onDesignExport={setArtworkUrl}
              selectedSize={selectedSizeValue}
            />
          </div>

        </div>
      </div>

      {/* ── STICKY ADD TO CART — mobile only (sm and below) ─────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 sm:hidden
                      bg-background/97 backdrop-blur-md border-t border-border shadow-2xl">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border overflow-hidden shrink-0">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-10 flex items-center justify-center hover:bg-muted transition-colors border-r border-border"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-9 h-10 flex items-center justify-center hover:bg-muted transition-colors border-l border-border"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <Button
            size="lg"
            className="flex-1 h-12 font-semibold gap-2 shadow-lg shadow-primary/25"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="w-4 h-4" /> Add to Cart
          </Button>
        </div>
      </div>

    </div>
  )
}
