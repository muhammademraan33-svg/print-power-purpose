/**
 * ApparelDesigner.tsx
 *
 * Apparel-specific designer for Printify products (T-shirts, hoodies, mugs, etc.)
 * Unlike the flat print canvas designer used for SinaLite products, this shows:
 *  • The actual product photo (garment mockup)
 *  • A drag-to-position design overlay on the product image
 *  • Visual "print area" zone so the user knows where the design will be printed
 *  • Size & Color option selectors
 *  • 300 DPI export of the design PNG (design-only file, sent to Printify as print file)
 */

import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import { Upload, Trash2, ZoomIn, ZoomOut, Move, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import type { FinalizeResult, DesignerRef } from './ProductDesigner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  productId: number | string
  productImage: string | null
  productName: string
  category: string
  /** Called each time the design PNG changes */
  onDesignExport: (dataUrl: string) => void
  selectedOptions: Record<string, string>
  onOptionChange: (name: string, value: string) => void
  optionGroups: Array<{ name: string; values: string[] }>
}

// Print area as fraction of product image dimensions (centered front print)
// Standard garment front print area: roughly 40% wide, centred around 40% from top
const PRINT_AREA = { left: 0.30, top: 0.28, width: 0.40, height: 0.38 }

// ─── Component ─────────────────────────────────────────────────────────────────

const ApparelDesigner = forwardRef<DesignerRef, Props>(
  function ApparelDesigner(
    { productId: _pid, productImage, productName, category, onDesignExport, selectedOptions, onOptionChange, optionGroups },
    ref,
  ) {
    const [designSrc, setDesignSrc] = useState<string | null>(null)
    const [designImg, setDesignImg] = useState<HTMLImageElement | null>(null)
    const [scale, setScale]         = useState(1)     // 0.5 – 2 relative to print area width
    const [offset, setOffset]       = useState({ x: 0, y: 0 }) // shift from print area centre
    const [isDragging, setIsDragging] = useState(false)
    const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

    const fileRef    = useRef<HTMLInputElement>(null)
    const previewRef = useRef<HTMLDivElement>(null)

    // ── Upload design ──────────────────────────────────────────────────────────
    const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        toast('Please upload an image file (PNG, JPG, etc.)', 'error')
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const src = ev.target?.result as string
        const img = new Image()
        img.onload = () => {
          setDesignImg(img)
          setDesignSrc(src)
          setScale(1)
          setOffset({ x: 0, y: 0 })
          onDesignExport(src)
          toast('Design uploaded — drag to reposition', 'success')
        }
        img.src = src
      }
      reader.readAsDataURL(file)
      // Reset input so same file can be re-uploaded
      e.target.value = ''
    }, [onDesignExport])

    // ── Mouse drag ─────────────────────────────────────────────────────────────
    const onMouseDown = useCallback((e: React.MouseEvent) => {
      if (!designSrc) return
      e.preventDefault()
      setIsDragging(true)
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
    }, [designSrc, offset])

    useEffect(() => {
      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging || !dragStart.current) return
        const dx = e.clientX - dragStart.current.mx
        const dy = e.clientY - dragStart.current.my
        setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
      }
      const onMouseUp = () => setIsDragging(false)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      return () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
    }, [isDragging])

    // ── Touch drag ─────────────────────────────────────────────────────────────
    const onTouchStart = useCallback((e: React.TouchEvent) => {
      if (!designSrc) return
      const t = e.touches[0]
      setIsDragging(true)
      dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y }
    }, [designSrc, offset])

    useEffect(() => {
      const onTouchMove = (e: TouchEvent) => {
        if (!isDragging || !dragStart.current) return
        const t = e.touches[0]
        const dx = t.clientX - dragStart.current.mx
        const dy = t.clientY - dragStart.current.my
        setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
      }
      const onTouchEnd = () => setIsDragging(false)
      window.addEventListener('touchmove', onTouchMove, { passive: false })
      window.addEventListener('touchend', onTouchEnd)
      return () => {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
    }, [isDragging])

    // ── Delete design ──────────────────────────────────────────────────────────
    const clearDesign = () => {
      setDesignSrc(null)
      setDesignImg(null)
      setScale(1)
      setOffset({ x: 0, y: 0 })
    }

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      hasContent: () => !!designSrc,

      finalize: async (): Promise<FinalizeResult> => {
        const errors: string[] = []
        const warnings: string[] = []

        if (!designSrc) {
          errors.push('No design uploaded. Please upload a design image.')
          return {
            dataUrl: '',
            pass: false,
            errors,
            warnings,
            preflightHash: '',
            designId: String(_pid),
          }
        }

        // Check required options
        const requiredOptions = optionGroups.map(g => g.name)
        for (const opt of requiredOptions) {
          if (!selectedOptions[opt]) {
            errors.push(`Please select a ${opt}.`)
          }
        }
        if (errors.length > 0) {
          return { dataUrl: '', pass: false, errors, warnings, preflightHash: '', designId: String(_pid) }
        }

        // Export design-only PNG at 300 DPI equivalent
        // We export at 3600×4800 (12"×16" @ 300dpi for standard front print)
        const EXPORT_W = 3600
        const EXPORT_H = 4800
        const offscreen = document.createElement('canvas')
        offscreen.width  = EXPORT_W
        offscreen.height = EXPORT_H
        const ctx = offscreen.getContext('2d')!

        // Transparent background (design file only — no garment background)
        ctx.clearRect(0, 0, EXPORT_W, EXPORT_H)

        if (designImg) {
          // Compute design dimensions relative to print area
          const previewEl = previewRef.current
          const previewW  = previewEl?.offsetWidth  || 400
          const previewH  = previewEl?.offsetHeight || 400
          const paW = previewW * PRINT_AREA.width
          const paH = previewH * PRINT_AREA.height

          const designDispW = paW * scale
          const designDispH = (designImg.naturalHeight / designImg.naturalWidth) * designDispW

          // Map to export canvas
          const scaleX = EXPORT_W / paW
          const scaleY = EXPORT_H / paH

          const cx = EXPORT_W / 2 + offset.x * scaleX
          const cy = EXPORT_H / 2 + offset.y * scaleY
          const dw = designDispW * scaleX
          const dh = designDispH * scaleY

          ctx.drawImage(designImg, cx - dw / 2, cy - dh / 2, dw, dh)
        }

        const dataUrl = offscreen.toDataURL('image/png')
        const hash    = btoa(designSrc.length + ':' + scale + ':' + JSON.stringify(offset)).slice(0, 32)

        return {
          dataUrl,
          pass: true,
          errors: [],
          warnings,
          preflightHash: hash,
          designId: `apparel-${_pid}-${Date.now()}`,
        }
      },
    }), [designSrc, designImg, scale, offset, _pid, selectedOptions, optionGroups])

    // ── Get print area background colour based on selected colour ─────────────
    const selectedColor = selectedOptions['Color'] || ''
    const isLight = ['White', 'Yellow', 'Gold', 'Light Blue', 'Light Pink', 'Natural'].some(c =>
      selectedColor.toLowerCase().includes(c.toLowerCase()),
    )
    const overlayTextColor = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)'

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div className="rounded-2xl border border-border/50 bg-white shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
          <div>
            <h3 className="font-semibold text-sm text-gray-800">Customize Your Design</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload artwork · drag to reposition · scale with zoom buttons
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {designSrc && (
              <>
                <button
                  onClick={() => setScale(s => Math.min(2, s + 0.1))}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-100 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-100 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={clearDesign}
                  className="w-8 h-8 rounded-lg border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors"
                  title="Remove design"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Product mockup + design overlay */}
        <div
          ref={previewRef}
          className="relative w-full bg-gray-100 select-none overflow-hidden"
          style={{ aspectRatio: '1 / 1', maxHeight: 460 }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          {/* Product image */}
          {productImage ? (
            <img
              src={productImage}
              alt={productName}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80'
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
              <span className="text-sm text-gray-400">No product image</span>
            </div>
          )}

          {/* Print area indicator */}
          <div
            className="absolute rounded border-2 border-dashed pointer-events-none transition-colors"
            style={{
              left:   `${PRINT_AREA.left   * 100}%`,
              top:    `${PRINT_AREA.top    * 100}%`,
              width:  `${PRINT_AREA.width  * 100}%`,
              height: `${PRINT_AREA.height * 100}%`,
              borderColor: designSrc ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.35)',
            }}
          >
            {!designSrc && (
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-center px-2 leading-snug"
                style={{ color: overlayTextColor || 'rgba(99,102,241,0.7)' }}
              >
                Print Area
              </span>
            )}
          </div>

          {/* Design overlay */}
          {designSrc && previewRef.current && (
            <div
              className="absolute pointer-events-none"
              style={{
                left:      `${PRINT_AREA.left   * 100}%`,
                top:       `${PRINT_AREA.top    * 100}%`,
                width:     `${PRINT_AREA.width  * 100}%`,
                height:    `${PRINT_AREA.height * 100}%`,
                overflow:  'visible',
              }}
            >
              <img
                src={designSrc}
                alt="Your design"
                className="absolute"
                style={{
                  // Centre the design in the print area then apply scale + offset
                  left:      '50%',
                  top:       '50%',
                  width:     `${scale * 100}%`,
                  height:    'auto',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  cursor:    isDragging ? 'grabbing' : 'grab',
                  pointerEvents: 'auto',
                }}
              />
            </div>
          )}

          {/* Drag hint */}
          {designSrc && !isDragging && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5
                            bg-black/60 text-white text-[10px] rounded-full px-2.5 py-1 pointer-events-none">
              <Move className="w-3 h-3" /> Drag to reposition
            </div>
          )}

          {/* Upload area (when no design) */}
          {!designSrc && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-end pb-6 gap-2
                          cursor-pointer group"
              onClick={() => fileRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2 bg-white/90 backdrop-blur-sm
                              border-2 border-dashed border-primary/40 group-hover:border-primary/70
                              rounded-2xl px-6 py-4 transition-all shadow-sm group-hover:shadow-md">
                <Upload className="w-6 h-6 text-primary/60 group-hover:text-primary" />
                <span className="text-sm font-semibold text-gray-700">Upload Your Design</span>
                <span className="text-xs text-muted-foreground">PNG, JPG, SVG — transparent background recommended</span>
              </div>
            </div>
          )}
        </div>

        {/* Garment options: Size + Color */}
        {optionGroups.length > 0 && (
          <div className="p-4 border-t border-border/30 space-y-4">
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

                {group.name === 'Color' ? (
                  /* Color swatches */
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((val) => {
                      const colorMap: Record<string, string> = {
                        Black: '#1a1a1a', White: '#f8f8f8', Navy: '#1a2744',
                        Red: '#cc1111', 'Royal Blue': '#2055cc', 'Forest Green': '#1a5c2a',
                        Maroon: '#6b1a1a', Gold: '#c9a227', Orange: '#e86808',
                        'Dark Heather': '#4a4a4a', 'Sport Grey': '#8a8a8a',
                        'Heather Grey': '#888', Pink: '#e879a4', 'Light Blue': '#7abfe0',
                        Natural: '#e8d5b7', 'Light Pink': '#f4b8cb',
                      }
                      const hex = colorMap[val] || '#888'
                      const isSelected = selectedOptions[group.name] === val
                      const isWhite = val === 'White'
                      return (
                        <button
                          key={val}
                          title={val}
                          onClick={() => onOptionChange(group.name, val)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            isSelected
                              ? 'border-primary scale-110 shadow-md'
                              : isWhite ? 'border-gray-300 hover:border-primary/50' : 'border-transparent hover:border-primary/50'
                          }`}
                          style={{ background: hex }}
                        />
                      )
                    })}
                  </div>
                ) : (
                  /* Size pills */
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((val) => (
                      <button
                        key={val}
                        onClick={() => onOptionChange(group.name, val)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          selectedOptions[group.name] === val
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background border-border text-foreground/80 hover:border-primary/50'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status bar */}
        <div className={`px-4 py-2.5 border-t text-xs flex items-center gap-2 ${
          designSrc ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-border/30 text-muted-foreground'
        }`}>
          {designSrc ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Design applied · Zoom {Math.round(scale * 100)}% · {category} print-on-demand via Printify
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              Upload a design to customise this {category.toLowerCase().replace(/s$/, '')}
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    )
  },
)

export default ApparelDesigner
