import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { useCart } from '@/contexts/CartContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, AlertTriangle, Package, ChevronRight, ShoppingCart,
  Check, Minus, Plus, Shield, Truck, Heart, CheckCircle2,
} from 'lucide-react'
import { formatPrice, calculateDonation } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import ProductDesigner, { type DesignerRef } from '@/components/product/ProductDesigner'
import ApparelDesigner from '@/components/product/ApparelDesigner'
import sinaliteData from '@/data/sinaliteProducts.json'
import { supabaseAdmin } from '@/services/supabase'
import { sinalitePriceApi } from '@/services/sinalite-price'
import { fetchPrintifyPrice } from '@/services/printify-price'
import { PDFDocument } from 'pdf-lib'

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

/** Upload design PNG dataUrl to Supabase Storage.
 *  Returns public URL on success, null if Supabase is not configured / upload fails. */
async function uploadDesignToSupabase(
  dataUrl: string,
  productId: string,
): Promise<string | null> {
  try {
    // Base64 → Blob
    const base64 = dataUrl.split(',')[1]
    if (!base64) return null
    const bytes = atob(base64)
    const arr   = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: 'image/png' })

    const fileName = `designs/${productId}-${Date.now()}.png`
    const { data, error } = await supabaseAdmin.storage
      .from('designs')
      .upload(fileName, blob, { contentType: 'image/png', upsert: false })

    if (error || !data) {
      console.warn('Supabase upload failed (bucket may not exist yet):', error?.message)
      return null
    }

    const { data: urlData } = supabaseAdmin.storage.from('designs').getPublicUrl(data.path)
    return urlData.publicUrl
  } catch (err) {
    console.warn('Supabase upload error:', err)
    return null
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  if (!base64) return new Uint8Array()
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return arr
}

async function uploadSinalitePdfToSupabase(
  frontDataUrl: string,
  backDataUrl?: string,
  productId?: string,
): Promise<string | null> {
  try {
    if (!frontDataUrl) return null
    const pdf = await PDFDocument.create()

    const frontBytes = dataUrlToBytes(frontDataUrl)
    const frontPng = await pdf.embedPng(frontBytes)
    const frontPage = pdf.addPage([frontPng.width, frontPng.height])
    frontPage.drawImage(frontPng, {
      x: 0,
      y: 0,
      width: frontPng.width,
      height: frontPng.height,
    })

    const hasBack = !!backDataUrl && backDataUrl.length > 0
    if (hasBack) {
      const backBytes = dataUrlToBytes(backDataUrl!)
      const backPng = await pdf.embedPng(backBytes)
      const backPage = pdf.addPage([backPng.width, backPng.height])
      backPage.drawImage(backPng, {
        x: 0,
        y: 0,
        width: backPng.width,
        height: backPng.height,
      })
    }

    const pdfBytes = await pdf.save()
    // pdf-lib returns a typed array; cast for TS's BlobPart compatibility.
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
    const fileName = `designs/${productId || 'sinalite'}-${Date.now()}.pdf`

    const { data, error } = await supabaseAdmin.storage
      .from('designs')
      .upload(fileName, blob, { contentType: 'application/pdf', upsert: false })

    if (error || !data) {
      console.warn('Supabase PDF upload failed (bucket may not exist yet):', error?.message)
      return null
    }

    const { data: urlData } = supabaseAdmin.storage.from('designs').getPublicUrl(data.path)
    return urlData.publicUrl
  } catch (err) {
    console.warn('Supabase PDF upload error:', err)
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const source    = searchParams.get('source') || 'sinalite'
  const navigate  = useNavigate()
  const { addItem } = useCart()

  const [quantity, setQuantity]             = useState(1)
  const [artworkUrl, setArtworkUrl]         = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  // Finalize flow state
  const [finalizing, setFinalizing]         = useState(false)
  const [finalizeErrors, setFinalizeErrors] = useState<string[]>([])
  const [designReady, setDesignReady]       = useState(false)

  const designerRef = useRef<DesignerRef>(null)

  const localProducts = (sinaliteData as any).products as any[]
  const localProduct  = localProducts.find((p: any) => String(p.id) === String(id))

  const localOptions: SinaliteOptionGroup[] =
    Array.isArray(localProduct?.options) ? localProduct.options : []

  const { data: apiOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['product-options', id, source],
    queryFn:  () => fetchSinaLiteOptions(id!),
    enabled:  !!id && source === 'sinalite' && localOptions.length === 0,
  })

  // For SinaLite: use local options (or API fallback)
  // For Printify: options are baked into the product JSON (sizes/colors)
  const optionGroups = source === 'printify'
    ? (localOptions.length > 0 ? localOptions : [])
    : (localOptions.length > 0 ? localOptions : apiOptions)

  // Reset selectedOptions when product changes so defaults apply to new product
  useEffect(() => {
    setSelectedOptions({})
  }, [id])

  // Initialize selectedOptions with defaults when optionGroups load (SinaLite only)
  useEffect(() => {
    if (source !== 'sinalite' || !optionGroups?.length) return
    setSelectedOptions(prev => {
      let changed = false
      const next = { ...prev }
      for (const g of optionGroups) {
        if (next[g.name] === undefined && g.values?.[0]) {
          next[g.name] = g.values[0]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [id, source, optionGroups])

  const hasQtyOption = source === 'sinalite' && optionGroups?.some((g) => g.name === 'qty')
  const qtyGroup = optionGroups?.find((g) => g.name === 'qty')
  const effectiveQuantity = hasQtyOption
    ? (() => {
        const raw = selectedOptions['qty'] || qtyGroup?.values?.[0] || '1'
        const n = parseInt(String(raw), 10)
        return Number.isFinite(n) && n >= 1 ? n : 1
      })()
    : quantity

  const selectedSizeValue: string | undefined = (() => {
    const sizeKey = Object.keys(selectedOptions).find(k => k.toLowerCase().includes('size'))
    return sizeKey ? selectedOptions[sizeKey] : undefined
  })()

  // Build SinaLite product option IDs for price API (use selected or first value per group)
  const sinaliteProductOptions = (() => {
    if (source !== 'sinalite' || !optionGroups?.length) return []
    const optionIds = (localProduct as { optionIds?: Record<string, Record<string, number>> })?.optionIds
    const groupsWithIds = optionGroups as Array<{ name: string; values?: string[]; optionIds?: Record<string, number> }>
    return groupsWithIds.flatMap((g) => {
      const value = selectedOptions[g.name] ?? g.values?.[0]
      if (!value) return []
      // Top-level optionIds first, fallback to per-group optionIds
      const optId = optionIds?.[g.name]?.[value] ?? g.optionIds?.[value]
      return typeof optId === 'number' ? [optId] : []
    }).filter(Boolean)
  })()

  // ── SinaLite price from API ─────────────────────────────────────────────
  const { data: sinalitePriceData, isLoading: sinalitePriceLoading } = useQuery({
    queryKey: ['sinalite-price', id, source, JSON.stringify(sinaliteProductOptions)],
    queryFn: async () => {
      const productId = typeof localProduct?.id === 'number' ? localProduct.id : parseInt(String(localProduct?.id), 10)
      if (!Number.isFinite(productId) || sinaliteProductOptions.length === 0) return null
      // SinaLite API: qty is encoded in the selected option IDs (including the "qty" option),
      // so we don't pass an explicit qty argument here.
      return sinalitePriceApi.calculatePrice(productId, sinaliteProductOptions)
    },
    enabled: !!localProduct && source === 'sinalite' && sinaliteProductOptions.length > 0,
    staleTime: 60_000,
  })

  // ── Printify price from API (blueprint cost + markup) ────────────────────
  const blueprintId = source === 'printify' && localProduct ? (localProduct as { blueprintId?: number }).blueprintId : undefined
  const { data: printifyPriceData, isLoading: printifyPriceLoading } = useQuery({
    queryKey: ['printify-price', blueprintId],
    queryFn: () => fetchPrintifyPrice(blueprintId!),
    enabled: !!blueprintId && source === 'printify',
    staleTime: 5 * 60_000,
  })

  // ── Add to Cart: runs finalize preflight, uploads design, then adds item ───
  const handleAddToCart = async () => {
    if (!localProduct) return
    setFinalizeErrors([])

    // If designer has content, run finalize + preflight
    if (designerRef.current?.hasContent()) {
      setFinalizing(true)
      toast('Preparing your print file…', 'success')

      const result = await designerRef.current.finalize()

      if (!result.pass) {
        setFinalizeErrors(result.errors)
        setFinalizing(false)
        toast(`Design issue: ${result.errors[0]}`, 'error')
        return
      }

      // Try Supabase upload (graceful fallback to dataUrl)
      let uploadedUrl: string | null = result.dataUrl
      if (result.dataUrl) {
        if (source === 'sinalite') {
          // SinaLite requires a PDF file. If a back-side design exists, include it too.
          const frontDataUrl = result.dataSide === 'front' ? result.dataUrl : result.backDataUrl
          const backDataUrl = result.dataSide === 'front' ? result.backDataUrl : result.dataUrl

          const page1 = frontDataUrl || backDataUrl
          const page2 = frontDataUrl && backDataUrl ? backDataUrl : undefined

          if (page1) {
            const pdfUrl = await uploadSinalitePdfToSupabase(page1, page2, String(localProduct.id))
            if (pdfUrl) {
              uploadedUrl = pdfUrl
              toast('SinaLite PDF uploaded to storage ✓', 'success')
            } else {
              // SinaLite expects PDF for validation; do not fall back to PNG/base64.
              toast('PDF upload failed. Please try again.', 'error')
              setFinalizeErrors(['Failed to generate/upload SinaLite PDF output.'])
              setFinalizing(false)
              return
            }
          }
        } else {
          const supabaseUrl = await uploadDesignToSupabase(result.dataUrl, String(localProduct.id))
          if (supabaseUrl) {
            uploadedUrl = supabaseUrl
            toast('Print file uploaded to storage ✓', 'success')
          } else {
            toast('Stored design locally (Supabase not yet configured)', 'success')
          }
        }

        setArtworkUrl(uploadedUrl)
        setDesignReady(true)
      }

      setFinalizing(false)
      addItem({
        id:            localProduct.id.toString(),
        productId:     typeof localProduct.id === 'number' ? localProduct.id : 0,
        name:          localProduct.name,
        priceCents:    unitPriceCents,
        quantity:      effectiveQuantity,
        jobTotalCents: jobTotalCents,
        imageUrl:      localProduct.image || undefined,
        configuration: selectedOptions,
        artworkUrl:    uploadedUrl || undefined,
        designId:      result.designId,
        preflightHash: result.preflightHash,
        vendor:        source as 'sinalite' | 'printify' | 'woocommerce',
      })
      toast('Added to cart!', 'success')
      navigate('/cart')

    } else {
      // No design — add directly
      addItem({
        id:           localProduct.id.toString(),
        productId:    typeof localProduct.id === 'number' ? localProduct.id : 0,
        name:         localProduct.name,
        priceCents:   unitPriceCents,
        quantity:     effectiveQuantity,
        jobTotalCents: jobTotalCents,
        imageUrl:     localProduct.image || undefined,
        configuration: selectedOptions,
        artworkUrl:   artworkUrl || undefined,
        vendor:       source as 'sinalite' | 'printify' | 'woocommerce',
      })
      toast('Added to cart!', 'success')
      navigate('/cart')
    }
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

  const fallbackPriceCents =
    localProduct.basePriceCents ?? (localProduct as { priceCents?: number }).priceCents ?? 5000

  // Compute a job-total price first, then derive internal per-unit from it for cart math.
  const jobTotalCents = (() => {
    // SinaLite: API returns total job price in price2.price (or price) for selected options + qty.
    const sinaliteApiPrice = (sinalitePriceData as { price?: string; price2?: { price?: number } })?.price2?.price ?? (sinalitePriceData as { price?: string })?.price
    if (source === 'sinalite' && sinaliteApiPrice != null) {
      const parsed = parseFloat(String(sinaliteApiPrice))
      if (Number.isFinite(parsed) && parsed > 0) {
        // 100% markup on wholesale: retail = wholesale * 2
        return Math.round(parsed * 100 * 2)
      }
      // If API comes back 0/invalid (or CORS/other issues), fall back to stored base price (job total).
      return fallbackPriceCents
    }

    // Printify: helper returns a per-unit price; multiply by qty for job total.
    if (source === 'printify' && printifyPriceData?.priceCents != null) {
      return printifyPriceData.priceCents * Math.max(1, effectiveQuantity)
    }

    // Fallback for anything else: treat stored base price as a job total for current configuration.
    return fallbackPriceCents
  })()

  const unitPriceCents = Math.round(jobTotalCents / Math.max(1, effectiveQuantity))
  const donationCents = calculateDonation(jobTotalCents)
  const priceLoading = (source === 'sinalite' && sinalitePriceLoading) || (source === 'printify' && printifyPriceLoading)

  // ─── Reusable content blocks ──────────────────────────────────────────────
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

  const uploadRequirements = (() => {
    const name = (localProduct?.name || '').toLowerCase()
    const cat = (localProduct?.category || '').toLowerCase()
    const reqs: string[] = []
    if (name.includes('foil') || name.includes('spot uv') || name.includes('spot uv')) {
      reqs.push('This product requires 2 files: design file + foil/spot UV layer.')
    }
    if (cat.includes('booklet')) {
      reqs.push('PDF upload recommended for booklets.')
    }
    return reqs
  })()

  const SpecsBlock = source === 'printify' ? (
    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-purple-800 text-sm mb-1.5">Print-on-Demand via Printify</h4>
          <ul className="text-xs text-purple-700 space-y-1">
            <li>• Upload PNG with transparent background for best results</li>
            <li>• Recommended design size: 4500 × 5400 px (15" × 18" @ 300 DPI)</li>
            <li>• Printed & shipped directly by Printify print partner</li>
            <li>• Drag your design to reposition · use zoom buttons to scale</li>
          </ul>
        </div>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-800 text-sm mb-1.5">Artwork Specifications</h4>
          <ul className="text-xs text-amber-700 space-y-1">
            <li>• 300 DPI resolution · CMYK color mode</li>
            <li>• 0.125" bleed on all edges (built in to designer)</li>
            <li>• Keep text 0.25" from trim edge (inside safe area)</li>
            <li>• Designer generates print-ready file automatically</li>
            {uploadRequirements.map((r, i) => (
              <li key={i} className="font-medium text-amber-800">• {r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  // Options sidebar block — only for SinaLite (Printify options live inside ApparelDesigner)
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
                <label className="text-sm font-semibold text-foreground">
                  {group.name === 'qty' ? 'Quantity' : group.name}
                </label>
                {selectedOptions[group.name] && (
                  <span className="text-xs text-primary font-medium">
                    {selectedOptions[group.name]}
                  </span>
                )}
              </div>
              {group.name === 'Color' ? (
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
              ) : (
                <select
                  value={selectedOptions[group.name] || ''}
                  onChange={(e) => setSelectedOptions(prev => ({ ...prev, [group.name]: e.target.value }))}
                  className="w-full max-w-xs h-10 px-4 rounded-lg border border-border bg-background text-sm font-medium
                             focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Select {group.name === 'qty' ? 'Quantity' : group.name}…</option>
                  {group.values.map((val) => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              )}
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

      {/* Qty stepper — only when there is no "qty" option in Product Options (e.g. Printify) */}
      {!hasQtyOption && (
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
      )}

      {/* Price rows (no explicit unit price row, only totals/donation) */}
      <div className="space-y-2 pt-3 border-t border-border/40">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-400" /> Auto Donation (est.)
          </span>
          <span className="font-semibold text-emerald-600">~{formatPrice(donationCents)}</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-2 border-t border-border/40">
          <span>Subtotal</span>
          <span>{priceLoading ? '…' : formatPrice(jobTotalCents)}</span>
        </div>
      </div>

      {/* Finalize errors */}
      {finalizeErrors.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Fix these before adding to cart:
          </p>
          {finalizeErrors.map((e, i) => (
            <p key={i} className="text-xs text-red-600">• {e}</p>
          ))}
        </div>
      )}

      {/* Design ready badge */}
      {designReady && !finalizeErrors.length && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50
                        border border-emerald-200 rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Print file ready — design passed all quality checks.
        </div>
      )}

      {/* Add to cart — desktop / tablet */}
      <Button
        size="lg"
        className="hidden sm:flex w-full h-14 text-base font-semibold gap-3 shadow-lg
                   shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all
                   disabled:opacity-60 disabled:pointer-events-none"
        onClick={handleAddToCart}
        disabled={finalizing}
      >
        {finalizing
          ? <><Loader2 className="w-5 h-5 animate-spin" /> Preparing print file…</>
          : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
        }
      </Button>

      {finalizing && (
        <p className="hidden sm:block text-xs text-muted-foreground text-center">
          Generating 300 DPI print file and running quality checks…
        </p>
      )}
      {!finalizing && (
        <p className="hidden sm:block text-xs text-muted-foreground text-center">
          Final price calculated based on your selected options and quantity.
        </p>
      )}

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
                      pb-24 sm:pb-6">

        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-12 xl:gap-16 gap-5">

          {/* ═══ RIGHT COLUMN — appears FIRST on mobile ═════════════════ */}
          <div className="order-1 lg:order-2 space-y-5">
            {TitleBlock}
            {SpecsBlock}
            {OptionsBlock}
            {QtyCartBlock}
          </div>

          {/* ═══ LEFT COLUMN — appears SECOND on mobile ══════════════════ */}
          <div className="order-2 lg:order-1 space-y-5">

            {source === 'printify' ? (
              /* ── Printify apparel: show mockup + overlay designer ── */
              <ApparelDesigner
                ref={designerRef}
                productId={localProduct.id}
                productImage={localProduct.image || null}
                productName={localProduct.name}
                category={localProduct.category}
                onDesignExport={setArtworkUrl}
                selectedOptions={selectedOptions}
                onOptionChange={(name, value) => setSelectedOptions(prev => ({ ...prev, [name]: value }))}
                optionGroups={optionGroups ?? []}
                printArea={localProduct.printArea}
              />
            ) : (
              /* ── SinaLite flat-print product ── */
              <>
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

                {/* Canvas print designer */}
                <ProductDesigner
                  ref={designerRef}
                  productId={typeof localProduct.id === 'number' ? localProduct.id : 0}
                  onDesignExport={setArtworkUrl}
                  selectedSize={selectedSizeValue}
                />
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── STICKY ADD TO CART — mobile only ─────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 sm:hidden
                      bg-background/97 backdrop-blur-md border-t border-border shadow-2xl">
        <div className="px-4 py-3 flex items-center gap-3">
          {!hasQtyOption && (
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
          )}
          <Button
            size="lg"
            className="flex-1 h-12 font-semibold gap-2 shadow-lg shadow-primary/25
                       disabled:opacity-60 disabled:pointer-events-none"
            onClick={handleAddToCart}
            disabled={finalizing}
          >
            {finalizing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
              : <><ShoppingCart className="w-4 h-4" /> Add to Cart</>
            }
          </Button>
        </div>
        {finalizing && (
          <p className="text-[10px] text-muted-foreground text-center pb-1">
            Generating print file & running quality checks…
          </p>
        )}
      </div>

    </div>
  )
}
