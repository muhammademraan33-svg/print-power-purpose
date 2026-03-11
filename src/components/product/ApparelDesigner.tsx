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
  /** Product's actual print area dimensions in inches (from product catalogue). */
  printArea?: { w: number; h: number }
}

// Default print area as fraction of product image dimensions (centred front print)
// Width kept narrow so the dashed box stays within the visible shirt body in mockup photos
const DEFAULT_PRINT_AREA = { left: 0.36, top: 0.28, width: 0.28, height: 0.38 }

// Typical garment body dimensions in inches (used to map product printArea → display fraction)
const GARMENT_BODY_W_IN = 20   // ~20" wide for a typical tee in the mockup
const GARMENT_BODY_H_IN = 28   // ~28" tall
// Scale down displayed width so dashed box matches shirt width in mockup (not full garment width)
const PRINT_AREA_WIDTH_SCALE = 0.64

// Margin (fraction) from print area edge to treat as "border" for dragging the box
const PRINT_BOX_DRAG_MARGIN = 0.02

// ─── Component ─────────────────────────────────────────────────────────────────

const ApparelDesigner = forwardRef<DesignerRef, Props>(
  function ApparelDesigner(
    { productId: _pid, productImage, productName, category, onDesignExport, selectedOptions, onOptionChange, optionGroups, printArea },
    ref,
  ) {
    // Compute the print area overlay: width scaled to fit shirt/mockup; height from print specs
    const PRINT_AREA = printArea
      ? (() => {
          const rawWidth = printArea.w / GARMENT_BODY_W_IN
          const width = Math.min(rawWidth * PRINT_AREA_WIDTH_SCALE, 0.34)
          const left = (1 - width) / 2
          return {
            left,
            top: 0.28,
            width,
            height: printArea.h / GARMENT_BODY_H_IN,
          }
        })()
      : DEFAULT_PRINT_AREA

    const [printAreaOffset, setPrintAreaOffset] = useState({ x: 0, y: 0 }) // fraction; moves the whole print box
    const [isDraggingBox, setIsDraggingBox] = useState(false)
    const dragStartBox = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

    const displayPrintArea = {
      left:   PRINT_AREA.left + printAreaOffset.x,
      top:    PRINT_AREA.top + printAreaOffset.y,
      width:  PRINT_AREA.width,
      height: PRINT_AREA.height,
    }
    const clampPrintAreaOffset = useCallback((x: number, y: number) => ({
      x: Math.max(-PRINT_AREA.left, Math.min(1 - PRINT_AREA.left - PRINT_AREA.width, x)),
      y: Math.max(-PRINT_AREA.top, Math.min(1 - PRINT_AREA.top - PRINT_AREA.height, y)),
    }), [PRINT_AREA.left, PRINT_AREA.top, PRINT_AREA.width, PRINT_AREA.height])

    // Front / Back sides
    const [activeSide, setActiveSide] = useState<'front' | 'back'>('front')
    const [backDesignSrc, setBackDesignSrc] = useState<string | null>(null)
    const [backDesignImg, setBackDesignImg] = useState<HTMLImageElement | null>(null)

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
          if (activeSide === 'back') {
            setBackDesignImg(img)
            setBackDesignSrc(src)
          } else {
            setDesignImg(img)
            setDesignSrc(src)
          }
          setScale(1)
          setOffset({ x: 0, y: 0 })
          onDesignExport(src)
          toast(`${activeSide === 'back' ? 'Back' : 'Front'} design uploaded — drag to reposition`, 'success')
        }
        img.src = src
      }
      reader.readAsDataURL(file)
      // Reset input so same file can be re-uploaded
      e.target.value = ''
    }, [onDesignExport, activeSide])

    // ── Hit test: is (xfrac,yfrac) in the print box border zone (for dragging the box)?
    const isInPrintBoxBorder = useCallback((xfrac: number, yfrac: number) => {
      const m = PRINT_BOX_DRAG_MARGIN
      const L = displayPrintArea.left
      const T = displayPrintArea.top
      const W = displayPrintArea.width
      const H = displayPrintArea.height
      const inOuter = xfrac >= L - m && xfrac <= L + W + m && yfrac >= T - m && yfrac <= T + H + m
      const inInner = xfrac >= L + m && xfrac <= L + W - m && yfrac >= T + m && yfrac <= T + H - m
      return inOuter && !inInner
    }, [displayPrintArea.left, displayPrintArea.top, displayPrintArea.width, displayPrintArea.height])

    const isInsidePrintBox = useCallback((xfrac: number, yfrac: number) => {
      const L = displayPrintArea.left
      const T = displayPrintArea.top
      const W = displayPrintArea.width
      const H = displayPrintArea.height
      return xfrac >= L && xfrac <= L + W && yfrac >= T && yfrac <= T + H
    }, [displayPrintArea.left, displayPrintArea.top, displayPrintArea.width, displayPrintArea.height])

    // ── Mouse drag ─────────────────────────────────────────────────────────────
    const onMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      const el = previewRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const xfrac = (e.clientX - rect.left) / rect.width
      const yfrac = (e.clientY - rect.top) / rect.height
      if (isInPrintBoxBorder(xfrac, yfrac) || (isInsidePrintBox(xfrac, yfrac) && !designSrc)) {
        setIsDraggingBox(true)
        dragStartBox.current = { mx: e.clientX, my: e.clientY, ox: printAreaOffset.x, oy: printAreaOffset.y }
        return
      }
      if (isInsidePrintBox(xfrac, yfrac) && designSrc) {
        setIsDragging(true)
        dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
      }
    }, [designSrc, offset, printAreaOffset, isInPrintBoxBorder, isInsidePrintBox])

    useEffect(() => {
      const onMouseMove = (e: MouseEvent) => {
        if (isDraggingBox && dragStartBox.current) {
          const el = previewRef.current
          if (!el) return
          const rect = el.getBoundingClientRect()
          const dxFrac = (e.clientX - dragStartBox.current.mx) / rect.width
          const dyFrac = (e.clientY - dragStartBox.current.my) / rect.height
          setPrintAreaOffset(clampPrintAreaOffset(
            dragStartBox.current!.ox + dxFrac,
            dragStartBox.current!.oy + dyFrac,
          ))
          return
        }
        if (!isDragging || !dragStart.current) return
        const dx = e.clientX - dragStart.current.mx
        const dy = e.clientY - dragStart.current.my
        const next = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy }
        setOffset(() => {
          const el = previewRef.current
          if (!el) return next
          const w = el.offsetWidth, h = el.offsetHeight
          const paW = w * displayPrintArea.width
          const paH = h * displayPrintArea.height
          const maxShift = Math.min(paW, paH) * 0.45
          return {
            x: Math.max(-maxShift, Math.min(maxShift, next.x)),
            y: Math.max(-maxShift, Math.min(maxShift, next.y)),
          }
        })
      }
      const onMouseUp = () => {
        setIsDragging(false)
        setIsDraggingBox(false)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      return () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
    }, [isDragging, isDraggingBox, displayPrintArea.width, displayPrintArea.height, clampPrintAreaOffset])

    // ── Touch drag ─────────────────────────────────────────────────────────────
    const onTouchStart = useCallback((e: React.TouchEvent) => {
      const t = e.touches[0]
      const el = previewRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const xfrac = (t.clientX - rect.left) / rect.width
      const yfrac = (t.clientY - rect.top) / rect.height
      if (isInPrintBoxBorder(xfrac, yfrac) || (isInsidePrintBox(xfrac, yfrac) && !designSrc)) {
        e.preventDefault()
        setIsDraggingBox(true)
        dragStartBox.current = { mx: t.clientX, my: t.clientY, ox: printAreaOffset.x, oy: printAreaOffset.y }
        return
      }
      if (isInsidePrintBox(xfrac, yfrac) && designSrc) {
        e.preventDefault()
        setIsDragging(true)
        dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y }
      }
    }, [designSrc, offset, printAreaOffset, isInPrintBoxBorder, isInsidePrintBox])

    useEffect(() => {
      const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0]
        if (isDraggingBox && dragStartBox.current && t) {
          const el = previewRef.current
          if (!el) return
          const rect = el.getBoundingClientRect()
          const dxFrac = (t.clientX - dragStartBox.current.mx) / rect.width
          const dyFrac = (t.clientY - dragStartBox.current.my) / rect.height
          setPrintAreaOffset(clampPrintAreaOffset(
            dragStartBox.current.ox + dxFrac,
            dragStartBox.current.oy + dyFrac,
          ))
          return
        }
        if (!isDragging || !dragStart.current) return
        const touch = e.touches[0]
        if (!touch) return
        const dx = touch.clientX - dragStart.current.mx
        const dy = touch.clientY - dragStart.current.my
        const next = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy }
        setOffset(() => {
          const el = previewRef.current
          if (!el) return next
          const w = el.offsetWidth, h = el.offsetHeight
          const paW = w * displayPrintArea.width
          const paH = h * displayPrintArea.height
          const maxShift = Math.min(paW, paH) * 0.45
          return {
            x: Math.max(-maxShift, Math.min(maxShift, next.x)),
            y: Math.max(-maxShift, Math.min(maxShift, next.y)),
          }
        })
      }
      const onTouchEnd = () => {
        setIsDragging(false)
        setIsDraggingBox(false)
      }
      window.addEventListener('touchmove', onTouchMove, { passive: false })
      window.addEventListener('touchend', onTouchEnd)
      return () => {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
    }, [isDragging, isDraggingBox, displayPrintArea.width, displayPrintArea.height, clampPrintAreaOffset])

    // ── Delete design ──────────────────────────────────────────────────────────
    const clearDesign = () => {
      if (activeSide === 'back') {
        setBackDesignSrc(null)
        setBackDesignImg(null)
      } else {
        setDesignSrc(null)
        setDesignImg(null)
      }
      setScale(1)
      setOffset({ x: 0, y: 0 })
    }

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      hasContent: () => !!designSrc || !!backDesignSrc,

      finalize: async (): Promise<FinalizeResult> => {
        const errors: string[] = []
        const warnings: string[] = []

        const activeSrcForFinalize = activeSide === 'back' ? backDesignSrc : designSrc
        if (!activeSrcForFinalize) {
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

        const designSrcForFinalize  = activeSrcForFinalize
        const designImgForFinalize  = activeSide === 'back' ? backDesignImg : designImg

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
        // Size based on actual print area (or default 12"×16") at 300 DPI
        const paWin   = printArea?.w ?? 12
        const paHin   = printArea?.h ?? 16
        const EXPORT_W = Math.round(paWin * 300)
        const EXPORT_H = Math.round(paHin * 300)
        const offscreen = document.createElement('canvas')
        offscreen.width  = EXPORT_W
        offscreen.height = EXPORT_H
        const ctx = offscreen.getContext('2d')!

        // Transparent background (design file only — no garment background)
        ctx.clearRect(0, 0, EXPORT_W, EXPORT_H)

        if (designImgForFinalize) {
          // Compute design dimensions relative to print area
          const previewEl = previewRef.current
          const previewW  = previewEl?.offsetWidth  || 400
          const previewH  = previewEl?.offsetHeight || 400
          const paW = previewW * PRINT_AREA.width
          const paH = previewH * PRINT_AREA.height

          const designDispW = paW * scale
          const designDispH = (designImgForFinalize.naturalHeight / designImgForFinalize.naturalWidth) * designDispW

          // Map to export canvas
          const scaleX = EXPORT_W / paW
          const scaleY = EXPORT_H / paH

          const cx = EXPORT_W / 2 + offset.x * scaleX
          const cy = EXPORT_H / 2 + offset.y * scaleY
          const dw = designDispW * scaleX
          const dh = designDispH * scaleY

          ctx.drawImage(designImgForFinalize, cx - dw / 2, cy - dh / 2, dw, dh)
        }

        const dataUrl = offscreen.toDataURL('image/png')
        const hash    = btoa(designSrcForFinalize.length + ':' + scale + ':' + JSON.stringify(offset)).slice(0, 32)

        return {
          dataUrl,
          pass: true,
          errors: [],
          warnings,
          preflightHash: hash,
          designId: `apparel-${_pid}-${Date.now()}`,
        }
      },
    }), [designSrc, backDesignSrc, designImg, backDesignImg, scale, offset, _pid, selectedOptions, optionGroups, activeSide, printArea, PRINT_AREA])

    // Determine which design is active for display
    const activeDesignSrc = activeSide === 'back' ? backDesignSrc : designSrc

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
        <div className="px-4 py-3 border-b border-border/30 bg-gradient-to-r from-purple-50 to-indigo-50 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-gray-800">Customize Your Design</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload artwork · drag design to reposition · drag print box to move area · zoom to scale
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {activeDesignSrc && (
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

          {/* Front / Back toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Side:</span>
            <div className="flex items-center rounded-lg border border-purple-200 overflow-hidden">
              <button
                onClick={() => { setActiveSide('front'); setScale(1); setOffset({ x: 0, y: 0 }) }}
                className={`px-4 h-7 text-xs font-semibold transition-colors ${
                  activeSide === 'front'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-50'
                }`}
              >
                ▣ Front
              </button>
              <button
                onClick={() => { setActiveSide('back'); setScale(1); setOffset({ x: 0, y: 0 }) }}
                className={`px-4 h-7 text-xs font-semibold border-l border-purple-200 transition-colors ${
                  activeSide === 'back'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-50'
                }`}
              >
                ▣ Back
                {backDesignSrc && activeSide !== 'back' && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block align-middle" />
                )}
              </button>
            </div>
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

          {/* Print area indicator (position uses displayPrintArea so it can be dragged) */}
          <div
            className="absolute rounded border-2 border-dashed transition-colors"
            style={{
              left:   `${displayPrintArea.left   * 100}%`,
              top:    `${displayPrintArea.top    * 100}%`,
              width:  `${displayPrintArea.width  * 100}%`,
              height: `${displayPrintArea.height * 100}%`,
              borderColor: activeDesignSrc ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.35)',
              cursor: isDraggingBox ? 'grabbing' : 'grab',
              pointerEvents: 'auto',
            }}
          >
            {!activeDesignSrc && (
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-center px-2 leading-snug"
                style={{ color: overlayTextColor || 'rgba(99,102,241,0.7)' }}
              >
                {activeSide === 'back' ? 'Back Print Area' : 'Print Area'}
              </span>
            )}
          </div>

          {/* Design overlay — overflow hidden so design stays inside print area */}
          {activeDesignSrc && previewRef.current && (
            <div
              className="absolute overflow-hidden rounded-sm pointer-events-none"
              style={{
                left:      `${displayPrintArea.left   * 100}%`,
                top:       `${displayPrintArea.top    * 100}%`,
                width:     `${displayPrintArea.width  * 100}%`,
                height:    `${displayPrintArea.height * 100}%`,
              }}
            >
              <img
                src={activeDesignSrc}
                alt="Your design"
                className="absolute"
                style={{
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
          {activeDesignSrc && !isDragging && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5
                            bg-black/60 text-white text-[10px] rounded-full px-2.5 py-1 pointer-events-none">
              <Move className="w-3 h-3" /> Drag to reposition
            </div>
          )}

          {/* Upload area (when no design for active side) */}
          {!activeDesignSrc && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-end pb-6 gap-2
                          cursor-pointer group"
              onClick={() => fileRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2 bg-white/90 backdrop-blur-sm
                              border-2 border-dashed border-primary/40 group-hover:border-primary/70
                              rounded-2xl px-6 py-4 transition-all shadow-sm group-hover:shadow-md">
                <Upload className="w-6 h-6 text-primary/60 group-hover:text-primary" />
                <span className="text-sm font-semibold text-gray-700">
                  Upload {activeSide === 'back' ? 'Back' : 'Front'} Design
                </span>
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
                  /* Size and other options — use dropdown */
                  <select
                    value={selectedOptions[group.name] || ''}
                    onChange={(e) => onOptionChange(group.name, e.target.value)}
                    className="w-full max-w-[200px] h-10 px-4 rounded-lg border border-border bg-background
                               text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Select {group.name}…</option>
                    {group.values.map((val) => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status bar */}
        <div className={`px-4 py-2.5 border-t text-xs flex items-center gap-2 ${
          activeDesignSrc ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-border/30 text-muted-foreground'
        }`}>
          {activeDesignSrc ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {activeSide === 'back' ? 'Back' : 'Front'} design applied · Zoom {Math.round(scale * 100)}% · {category} print-on-demand via Printify
              {backDesignSrc && designSrc && (
                <span className="ml-1 font-medium text-emerald-600">(Both sides designed)</span>
              )}
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              Upload a {activeSide} design to customise this {category.toLowerCase().replace(/s$/, '')}
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
