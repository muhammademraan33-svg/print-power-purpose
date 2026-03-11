/**
 * ProductDesigner.tsx  —  Vistaprint-inspired canvas designer
 *
 * Canvas layout (mirrors industry-standard print specs):
 *  ┌─────────────────────────────────────┐  ← canvas edge (full bleed area)
 *  │ ░░░░ BLEED ZONE (0.125") ░░░░░░░░  │
 *  │ ░ ┌─────────────────────────────┐ ░│  ← TRIM LINE — where product is cut
 *  │ ░ │ · · · SAFE AREA  · · · · · │ ░│  ← SAFE AREA GUIDE (dashed) — drawn ABOVE images
 *  │ ░ │ ·                         · │ ░│
 *  │ ░ │ ·      DESIGN AREA        · │ ░│
 *  │ ░ │ · · · · · · · · · · · · · · │ ░│
 *  │ ░ └─────────────────────────────┘ ░│
 *  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 *  └─────────────────────────────────────┘
 *
 * Ratio technique: selecting "16 x 9" always gives a wider canvas than "12 x 9".
 *
 * Features:
 *  • Correct aspect ratio per selected size (+ bleed)
 *  • Bleed zone (pink) · Trim line (solid red) · Safe area (dashed blue) — ALWAYS above images
 *  • Elements clamped within canvas frame — nothing goes outside the red box
 *  • Mobile touch drag + resize support (touchstart/move/end)
 *  • Image upload, drag-to-move, 8-handle resize, replace, delete
 *  • Text add, drag-to-move, bold/italic/colour/size, inline editing
 *  • Real-time preflight: DPI check, safe-area violation, empty-canvas warning
 *  • Finalize method (via ref): generates 300 DPI PNG, runs preflight, no auto-download
 *  • Undo / Redo (20-level history)
 */

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Upload, Type, Trash2, Bold, Italic,
  Palette, RefreshCw, Layers, Undo2, Redo2, Info,
  AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { toast } from '@/components/ui/toaster'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DesignElement {
  id: string
  type: 'image' | 'text'
  /** Position + size as fraction of canvas width/height (0–1). */
  xPct: number; yPct: number; wPct: number; hPct: number
  // image
  src?: string; imgEl?: HTMLImageElement; naturalRatio?: number
  // text
  text?: string; fontSizePct?: number; color?: string
  bold?: boolean; italic?: boolean; fontFamily?: string
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type ActionType   = 'drag' | `resize-${ResizeHandle}`

interface Interaction {
  id: string; action: ActionType
  startMouseX: number; startMouseY: number
  startXPct: number; startYPct: number; startWPct: number; startHPct: number
}

export interface FinalizeResult {
  dataUrl: string
  /** High-res PNG for the back side (present only when a back-side design exists). */
  backDataUrl?: string
  pass: boolean
  errors: string[]
  warnings: string[]
  /** Stable hash of the design state — used by checkout to detect mutations. */
  preflightHash: string
  /** Session-unique ID for this design (referenced by backend /finalize endpoint). */
  designId: string
}

export interface DesignerRef {
  /** Generate high-res PNG, run preflight, return result (no download). */
  finalize(): Promise<FinalizeResult>
  /** True when canvas has at least one element. */
  hasContent(): boolean
}

interface Props {
  productId: number | string
  onDesignExport: (dataUrl: string) => void
  /** e.g. "3.5 x 2" — drives canvas aspect ratio  */
  selectedSize?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_W      = 580   // max canvas display width (px)
const MAX_H      = 460   // max canvas display height (px)
const BLEED_IN   = 0.125 // 0.125" bleed
const SAFE_IN    = 0.125 // 0.125" safe margin inside trim
const H          = 8     // handle square half-size (px)
const DEF_FSZ    = 0.06  // default font = 6% of canvas height
const EXPORT_DPI = 300
const MAX_HIST   = 20

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4)

function parseSz(s?: string): { w: number; h: number } | null {
  if (!s) return null
  const m = s.match(/([\d.]+)\s*[xX×]\s*([\d.]+)/)
  if (!m) return null
  const w = parseFloat(m[1]), h = parseFloat(m[2])
  return (w > 0 && h > 0) ? { w, h } : null
}

/** Canvas pixel dimensions for the FULL BLEED area. */
function calcCsz(sizeStr?: string): { w: number; h: number } {
  const p = parseSz(sizeStr)
  if (!p) return { w: MAX_W, h: Math.round(MAX_W * 0.625) }
  const fw = p.w + 2 * BLEED_IN, fh = p.h + 2 * BLEED_IN
  const ratio = fw / fh
  return ratio >= MAX_W / MAX_H
    ? { w: MAX_W,                              h: Math.max(80, Math.round(MAX_W / ratio)) }
    : { w: Math.max(80, Math.round(MAX_H * ratio)), h: MAX_H }
}

/** Pixel positions for trim line and safe-area guide. */
function guides(csz: { w: number; h: number }, sizeStr?: string) {
  const p = parseSz(sizeStr)
  if (!p) {
    const b = Math.round(Math.min(csz.w, csz.h) * 0.04)
    return { bx: b, by: b, sx: b * 2, sy: b * 2 }
  }
  const fw = p.w + 2 * BLEED_IN, fh = p.h + 2 * BLEED_IN
  const bx = Math.round(BLEED_IN * csz.w / fw)
  const by = Math.round(BLEED_IN * csz.h / fh)
  const sx = Math.round((BLEED_IN + SAFE_IN) * csz.w / fw)
  const sy = Math.round((BLEED_IN + SAFE_IN) * csz.h / fh)
  return { bx, by, sx, sy }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, maxW: number, lh: number,
) {
  const words = text.split(' ')
  let line = '', ly = y
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, ly); line = w; ly += lh }
    else line = t
  }
  if (line) ctx.fillText(line, x, ly)
}

/** 8 handle pixel positions for a selected element. */
function handlePositions(el: DesignElement, csz: { w: number; h: number }) {
  const ex = el.xPct * csz.w, ey = el.yPct * csz.h
  const ew = el.wPct * csz.w, eh = el.hPct * csz.h
  return {
    nw: [ex,         ey        ] as [number, number],
    n:  [ex + ew/2,  ey        ] as [number, number],
    ne: [ex + ew,    ey        ] as [number, number],
    e:  [ex + ew,    ey + eh/2 ] as [number, number],
    se: [ex + ew,    ey + eh   ] as [number, number],
    s:  [ex + ew/2,  ey + eh   ] as [number, number],
    sw: [ex,         ey + eh   ] as [number, number],
    w:  [ex,         ey + eh/2 ] as [number, number],
  }
}

const RESIZE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
  se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize',
}

// ─── Component ────────────────────────────────────────────────────────────────

const ProductDesigner = forwardRef<DesignerRef, Props>(
  function ProductDesigner({ productId: _pid, onDesignExport, selectedSize }, ref) {

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cursorRef    = useRef('default')

  const [csz, setCsz]             = useState(() => calcCsz(selectedSize))
  const [elements, setElements]   = useState<DesignElement[]>([])
  const [selectedId, setSelId]    = useState<string | null>(null)
  const [interaction, setIa]      = useState<Interaction | null>(null)
  const [editingId, setEditId]    = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')

  // Front / Back sides — savedSidesRef stores the inactive side's elements
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front')
  const savedSidesRef = useRef<{ front: DesignElement[]; back: DesignElement[] }>({ front: [], back: [] })

  // Stable design session ID (used by backend finalize endpoint)
  const designIdRef = useRef(uid())

  // Preflight state (recomputed on every element change)
  const [preflightErrors,   setPreflightErrors  ] = useState<string[]>([])
  const [preflightWarnings, setPreflightWarnings] = useState<string[]>([])

  // Undo / Redo
  const histRef    = useRef<DesignElement[][]>([[]])
  const histIdxRef = useRef(0)
  const [histState, setHistState] = useState({ idx: 0, len: 1 })

  // Stable refs — always hold the latest state for the draw/event callbacks
  const elRef  = useRef(elements)
  const selRef = useRef(selectedId)
  const editR  = useRef(editingId)
  const txtR   = useRef(textInput)
  const cszR   = useRef(csz)
  const ssR    = useRef(selectedSize)
  const iaR    = useRef(interaction)

  useEffect(() => { elRef.current = elements    }, [elements])
  useEffect(() => { selRef.current = selectedId }, [selectedId])
  useEffect(() => { editR.current  = editingId  }, [editingId])
  useEffect(() => { txtR.current   = textInput  }, [textInput])
  useEffect(() => { cszR.current   = csz        }, [csz])
  useEffect(() => { ssR.current    = selectedSize }, [selectedSize])
  useEffect(() => { iaR.current    = interaction  }, [interaction])

  // Touch: last-tap tracking for double-tap-to-edit
  const lastTapTimeRef = useRef(0)

  // ── Resize canvas when selectedSize changes ───────────────────────────────
  const prevSzRef = useRef(selectedSize)
  useEffect(() => {
    if (prevSzRef.current === selectedSize) return
    prevSzRef.current = selectedSize
    setCsz(calcCsz(selectedSize))
    setEditId(null)
  }, [selectedSize])

  // ── History helpers ───────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    const snap = elRef.current.map(e => ({ ...e, imgEl: e.imgEl }))
    histRef.current = histRef.current.slice(0, histIdxRef.current + 1)
    histRef.current.push(snap)
    if (histRef.current.length > MAX_HIST) histRef.current.shift()
    histIdxRef.current = histRef.current.length - 1
    setHistState({ idx: histIdxRef.current, len: histRef.current.length })
  }, [])

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return
    histIdxRef.current -= 1
    const snap = histRef.current[histIdxRef.current]
    setElements(snap.map(e => ({ ...e })))
    setSelId(null); setEditId(null)
    setHistState({ idx: histIdxRef.current, len: histRef.current.length })
  }, [])

  const redo = useCallback(() => {
    if (histIdxRef.current >= histRef.current.length - 1) return
    histIdxRef.current += 1
    const snap = histRef.current[histIdxRef.current]
    setElements(snap.map(e => ({ ...e })))
    setSelId(null); setEditId(null)
    setHistState({ idx: histIdxRef.current, len: histRef.current.length })
  }, [])

  // ── Front / Back side switch ───────────────────────────────────────────────
  const switchSide = useCallback((side: 'front' | 'back') => {
    if (side === activeSide) return
    // Persist current side's elements
    savedSidesRef.current[activeSide] = elRef.current.map(e => ({ ...e }))
    // Restore the target side's elements (empty array on first visit)
    const next = savedSidesRef.current[side].map(e => ({ ...e }))
    setElements(next)
    setSelId(null)
    setEditId(null)
    setActiveSide(side)
    // Reset history for the new side
    histRef.current    = [next]
    histIdxRef.current = 0
    setHistState({ idx: 0, len: 1 })
  }, [activeSide])

  // ── DRAW ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const els      = elRef.current
    const sel      = selRef.current
    const editing  = editR.current
    const liveText = txtR.current
    const { w, h } = cszR.current
    const sizeLbl  = ssR.current
    const g        = guides(cszR.current, sizeLbl)

    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    // ── 1. Bleed zone (full canvas background = pink bleed colour) ────────
    ctx.fillStyle = '#fde8e8'
    ctx.fillRect(0, 0, w, h)

    // Print area (white)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(g.bx, g.by, w - 2 * g.bx, h - 2 * g.by)

    // Subtle grid (inside print area only)
    ctx.save()
    ctx.beginPath(); ctx.rect(g.bx, g.by, w - 2 * g.bx, h - 2 * g.by); ctx.clip()
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 0.5
    for (let x = g.bx; x <= w - g.bx; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, g.by); ctx.lineTo(x, h - g.by); ctx.stroke()
    }
    for (let y = g.by; y <= h - g.by; y += 32) {
      ctx.beginPath(); ctx.moveTo(g.bx, y); ctx.lineTo(w - g.bx, y); ctx.stroke()
    }
    ctx.restore()

    // ── 2. Elements (images + text) — drawn BELOW the guide lines ─────────
    for (const el of els) {
      const ex = el.xPct * w, ey = el.yPct * h
      const ew = el.wPct * w, eh = el.hPct * h

      if (el.type === 'image' && el.imgEl) {
        ctx.drawImage(el.imgEl, ex, ey, ew, eh)

      } else if (el.type === 'text') {
        const dispText = (el.id === editing ? liveText : el.text) || ''
        const fs = Math.round((el.fontSizePct ?? DEF_FSZ) * h)

        if (el.id === editing) {
          ctx.save()
          ctx.fillStyle = 'rgba(59,130,246,0.06)'; ctx.fillRect(ex, ey, ew, eh)
          ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3])
          ctx.strokeRect(ex, ey, ew, eh); ctx.setLineDash([])
          ctx.restore()
        }
        if (dispText) {
          ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${fs}px ${el.fontFamily || '"Plus Jakarta Sans", Arial, sans-serif'}`
          ctx.fillStyle = el.id === editing ? (el.color || '#1a1a2e') + '99' : (el.color || '#1a1a2e')
          ctx.textBaseline = 'top'
          wrapText(ctx, dispText, ex + 2, ey + 3, ew - 4, fs * 1.35)
        }
      }

      // ── Selection + handles ─────────────────────────────────────────────
      if (el.id === sel && el.id !== editing) {
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([])
        ctx.strokeRect(ex - 1, ey - 1, ew + 2, eh + 2)

        const hp = handlePositions(el, cszR.current)
        for (const [, [hx, hy]] of Object.entries(hp) as [string, [number, number]][]) {
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5
          ctx.fillRect(hx - H, hy - H, H * 2, H * 2)
          ctx.strokeRect(hx - H, hy - H, H * 2, H * 2)
        }

        // Delete button (red circle top-right)
        const dbx = ex + ew + 10, dby = ey - 10
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(dbx, dby, 10, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('✕', dbx, dby)
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      }
    }

    // ── 3. Trim line — drawn ABOVE elements so it's always visible ────────
    ctx.strokeStyle = 'rgba(160,0,0,0.75)'; ctx.lineWidth = 1.5; ctx.setLineDash([])
    ctx.strokeRect(g.bx, g.by, w - 2 * g.bx, h - 2 * g.by)

    // Crop-mark corners
    const mk = 5
    ctx.strokeStyle = 'rgba(120,0,0,0.7)'; ctx.lineWidth = 1
    const corners: [number, number, number, number][] = [
      [g.bx,     g.by,     -mk, -mk],
      [w - g.bx, g.by,      mk, -mk],
      [g.bx,     h - g.by, -mk,  mk],
      [w - g.bx, h - g.by,  mk,  mk],
    ]
    for (const [cx, cy, ox, oy] of corners) {
      ctx.beginPath(); ctx.moveTo(cx + ox, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + oy); ctx.stroke()
    }

    // ── 4. Safe area guide (dashed blue) — drawn ABOVE everything ─────────
    ctx.strokeStyle = 'rgba(59,130,246,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
    ctx.strokeRect(g.sx, g.sy, w - 2 * g.sx, h - 2 * g.sy)
    ctx.setLineDash([])

    // ── 5. Zone labels ────────────────────────────────────────────────────
    ctx.font = '9px Arial'; ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(59,130,246,0.75)'
    ctx.fillText('Safe area', g.sx + 4, g.sy + 3)
    ctx.fillStyle = 'rgba(180,0,0,0.6)'
    ctx.fillText('← Bleed (0.125")', g.bx + 2, 2)

    // ── 6. Size watermark ─────────────────────────────────────────────────
    if (sizeLbl) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.font = '9px Arial'
      ctx.textBaseline = 'bottom'; ctx.textAlign = 'right'
      ctx.fillText(`${sizeLbl}" + 0.125" bleed`, w - 5, h - 3)
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    }

    // ── 7. Empty-state prompt ─────────────────────────────────────────────
    if (els.length === 0) {
      ctx.fillStyle = 'rgba(100,116,139,0.5)'
      ctx.font = '13px "Plus Jakarta Sans", Arial, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('Upload an image or add text to start designing', w / 2, h / 2 - 10)
      ctx.font = '11px Arial'
      ctx.fillText('Drag and drop an image file onto the canvas', w / 2, h / 2 + 12)
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    }
  }, [])

  useEffect(() => { draw() }, [draw, elements, selectedId, editingId, textInput, csz, selectedSize])

  // ── Real-time Preflight (internal — returns simple check result) ──────────
  type PreflightCheck = { pass: boolean; errors: string[]; warnings: string[] }

  const runPreflight = useCallback((els: DesignElement[], sizeStr?: string): PreflightCheck => {
    const errors: string[]   = []
    const warnings: string[] = []
    const p = parseSz(sizeStr)

    if (!p) {
      warnings.push('Select a product size above to activate the canvas.')
      return { pass: true, errors, warnings }
    }

    const fw = p.w + 2 * BLEED_IN, fh = p.h + 2 * BLEED_IN
    const csz = cszR.current
    const g   = guides(csz, sizeStr)
    const safeXFrac = g.sx / csz.w
    const safeYFrac = g.sy / csz.h

    if (els.length === 0) {
      warnings.push('Canvas is empty — upload an image or add text.')
      return { pass: true, errors, warnings }
    }

    for (const el of els) {
      if (el.type === 'image' && el.imgEl) {
        const elWidthIn  = el.wPct * fw
        const elHeightIn = el.hPct * fh
        const dpiX = elWidthIn  > 0 ? el.imgEl.naturalWidth  / elWidthIn  : 0
        const dpiY = elHeightIn > 0 ? el.imgEl.naturalHeight / elHeightIn : 0
        const dpi  = Math.min(dpiX, dpiY)
        if (dpi > 0 && dpi < 150) {
          errors.push(`Image DPI too low (${Math.round(dpi)} DPI — need 300+). Replace with a higher-res image.`)
        } else if (dpi >= 150 && dpi < 300) {
          warnings.push(`Image may print slightly soft (${Math.round(dpi)} DPI — 300+ recommended).`)
        }
      }

      if (el.type === 'text') {
        const r = 1 - safeXFrac
        const b = 1 - safeYFrac
        if (el.xPct < safeXFrac || el.xPct + el.wPct > r || el.yPct < safeYFrac || el.yPct + el.hPct > b) {
          warnings.push('Text extends outside the safe area — keep important content inside the dashed line.')
        }
      }
    }

    return { pass: errors.length === 0, errors, warnings }
  }, [])

  // Recompute preflight whenever elements or size changes
  useEffect(() => {
    const result = runPreflight(elements, selectedSize)
    setPreflightErrors(result.errors)
    setPreflightWarnings(result.warnings)
  }, [elements, selectedSize, runPreflight])

  // ── Canvas coords helper ──────────────────────────────────────────────────
  const toCanvasFromClient = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return {
      x: (clientX - r.left) * (c.width  / r.width),
      y: (clientY - r.top)  * (c.height / r.height),
    }
  }, [])

  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>) =>
    toCanvasFromClient(e.clientX, e.clientY)

  // ── Hit tests ─────────────────────────────────────────────────────────────
  const hitEl = (x: number, y: number): DesignElement | null => {
    const { w, h } = cszR.current
    for (let i = elRef.current.length - 1; i >= 0; i--) {
      const el = elRef.current[i]
      const ex = el.xPct * w, ey = el.yPct * h, ew = el.wPct * w, eh = el.hPct * h
      if (x >= ex && x <= ex + ew && y >= ey && y <= ey + eh) return el
    }
    return null
  }

  const hitDelete = (x: number, y: number, el: DesignElement) => {
    const { w, h } = cszR.current
    return Math.hypot(x - (el.xPct * w + el.wPct * w + 10), y - (el.yPct * h - 10)) <= 10
  }

  const hitHandle = (x: number, y: number, el: DesignElement): ResizeHandle | null => {
    const hp = handlePositions(el, cszR.current)
    for (const [name, [hx, hy]] of Object.entries(hp) as [ResizeHandle, [number, number]][]) {
      if (Math.abs(x - hx) <= H + 2 && Math.abs(y - hy) <= H + 2) return name
    }
    return null
  }

  // ── Pointer-agnostic interaction handlers ─────────────────────────────────
  const handlePointerDown = useCallback((x: number, y: number) => {
    const curSel = selRef.current

    if (curSel) {
      const sel = elRef.current.find(el => el.id === curSel)
      if (sel && hitDelete(x, y, sel)) { deleteEl(sel.id); return }
      if (sel) {
        const rh = hitHandle(x, y, sel)
        if (rh) {
          setIa({ id: sel.id, action: `resize-${rh}`, startMouseX: x, startMouseY: y,
                  startXPct: sel.xPct, startYPct: sel.yPct, startWPct: sel.wPct, startHPct: sel.hPct })
          return
        }
      }
    }

    const hit = hitEl(x, y)
    if (hit) {
      setSelId(hit.id)
      setIa({ id: hit.id, action: 'drag', startMouseX: x, startMouseY: y,
               startXPct: hit.xPct, startYPct: hit.yPct, startWPct: hit.wPct, startHPct: hit.hPct })
    } else {
      setSelId(null)
      if (editR.current) commitEdit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerMove = useCallback((x: number, y: number) => {
    const ia = iaR.current

    if (ia) {
      const { w, h } = cszR.current
      const dx = (x - ia.startMouseX) / w
      const dy = (y - ia.startMouseY) / h
      const MIN = 0.03

      setElements(prev => prev.map(el => {
        if (el.id !== ia.id) return el

        if (ia.action === 'drag') {
          const newX = ia.startXPct + dx
          const newY = ia.startYPct + dy

          if (el.type === 'image') {
            // Images must keep covering the trim area — no white gap at the print boundary
            const g       = guides(cszR.current, ssR.current)
            const bxPct   = g.bx / w
            const byPct   = g.by / h
            const trimRPct = (w - g.bx) / w
            const trimBPct = (h - g.by) / h
            const trimWPct = trimRPct - bxPct
            const trimHPct = trimBPct - byPct

            const minX = el.wPct >= trimWPct ? trimRPct - el.wPct : 0
            const maxX = el.wPct >= trimWPct ? bxPct               : 1 - el.wPct
            const minY = el.hPct >= trimHPct ? trimBPct - el.hPct  : 0
            const maxY = el.hPct >= trimHPct ? byPct                : 1 - el.hPct

            return {
              ...el,
              xPct: Math.max(minX, Math.min(maxX, newX)),
              yPct: Math.max(minY, Math.min(maxY, newY)),
            }
          }

          // Text: clamp within full canvas
          return {
            ...el,
            xPct: Math.max(0, Math.min(1 - el.wPct, newX)),
            yPct: Math.max(0, Math.min(1 - el.hPct, newY)),
          }
        }

        // Resize
        let { startXPct: xp, startYPct: yp, startWPct: wp, startHPct: hp } = ia
        switch (ia.action) {
          case 'resize-nw': xp += dx; yp += dy; wp -= dx; hp -= dy; break
          case 'resize-n':              yp += dy; hp -= dy; break
          case 'resize-ne':              yp += dy; wp += dx; hp -= dy; break
          case 'resize-e':                         wp += dx; break
          case 'resize-se':              wp += dx; hp += dy; break
          case 'resize-s':                          hp += dy; break
          case 'resize-sw': xp += dx;    wp -= dx; hp += dy; break
          case 'resize-w':  xp += dx;    wp -= dx; break
        }

        // Clamp minimum size
        if (wp < MIN) { if (ia.action.includes('w')) xp = ia.startXPct + ia.startWPct - MIN; wp = MIN }
        if (hp < MIN) { if (ia.action.includes('n')) yp = ia.startYPct + ia.startHPct - MIN; hp = MIN }

        // CLAMP: keep within canvas bounds
        xp = Math.max(0, xp)
        yp = Math.max(0, yp)
        wp = Math.min(wp, 1 - xp)
        hp = Math.min(hp, 1 - yp)

        // For text: scale font size proportionally with box height
        if (el.type === 'text') {
          const oldHeightPx = ia.startHPct * h
          const newHeightPx = hp * h
          const scale = oldHeightPx > 0 ? newHeightPx / oldHeightPx : 1
          const oldFontSizePct = el.fontSizePct ?? DEF_FSZ
          const newFontSizePct = Math.max(0.01, Math.min(0.3, oldFontSizePct * scale))
          return { ...el, xPct: xp, yPct: yp, wPct: wp, hPct: hp, fontSizePct: newFontSizePct }
        }

        return { ...el, xPct: xp, yPct: yp, wPct: wp, hPct: hp }
      }))

    } else {
      // Update cursor hint
      const canvas = canvasRef.current
      if (!canvas) return
      let cur = 'default'
      const curSel = selRef.current
      if (curSel) {
        const sel = elRef.current.find(el => el.id === curSel)
        if (sel) {
          if (hitDelete(x, y, sel)) cur = 'pointer'
          else {
            const rh = hitHandle(x, y, sel)
            if (rh) cur = RESIZE_CURSORS[rh]
            else if (hitEl(x, y)?.id === curSel) cur = 'grab'
          }
        }
      } else if (hitEl(x, y)) cur = 'grab'
      if (cur !== cursorRef.current) { cursorRef.current = cur; canvas.style.cursor = cur }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerUp = useCallback(() => {
    if (iaR.current) saveHistory()
    setIa(null)
    if (canvasRef.current) canvasRef.current.style.cursor = cursorRef.current = 'default'
  }, [saveHistory])

  // ── Mouse events ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e)
    handlePointerDown(x, y)
  }
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e)
    handlePointerMove(x, y)
  }
  const onMouseUp = handlePointerUp

  const onDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e)
    const hit = hitEl(x, y)
    if (hit?.type === 'text') { setEditId(hit.id); setTextInput(hit.text || ''); setSelId(hit.id) }
  }

  // ── Touch events (mobile drag + resize support) ────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault() // prevent scroll / zoom while designing
    const touch = e.touches[0]; if (!touch) return
    const { x, y } = toCanvasFromClient(touch.clientX, touch.clientY)

    // Double-tap → edit text
    const now = Date.now()
    if (now - lastTapTimeRef.current < 300) {
      lastTapTimeRef.current = 0
      const hit = hitEl(x, y)
      if (hit?.type === 'text') {
        setEditId(hit.id); setTextInput(hit.text || ''); setSelId(hit.id)
      }
      return
    }
    lastTapTimeRef.current = now
    handlePointerDown(x, y)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toCanvasFromClient, handlePointerDown])

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]; if (!touch) return
    const { x, y } = toCanvasFromClient(touch.clientX, touch.clientY)
    handlePointerMove(x, y)
  }, [toCanvasFromClient, handlePointerMove])

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    handlePointerUp()
  }, [handlePointerUp])

  // ── Text editing ──────────────────────────────────────────────────────────
  const commitEdit = useCallback(() => {
    const id = editR.current; if (!id) return
    const val = txtR.current.trim() || 'Your text here'
    setElements(prev => prev.map(el => el.id === id ? { ...el, text: val } : el))
    setEditId(null)
    setTimeout(saveHistory, 0)
  }, [saveHistory])

  // ── Element operations ────────────────────────────────────────────────────
  const deleteEl = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id))
    setSelId(prev => prev === id ? null : prev)
    setEditId(prev => prev === id ? null : prev)
    setTimeout(saveHistory, 0)
  }, [saveHistory])

  const addText = useCallback(() => {
    const id = uid()
    const el: DesignElement = {
      id, type: 'text', xPct: 0.12, yPct: 0.38, wPct: 0.76, hPct: 0.24,
      text: 'Your text here', fontSizePct: DEF_FSZ, color: '#1a1a2e',
    }
    setElements(prev => [...prev, el])
    setSelId(id); setEditId(id); setTextInput('Your text here')
    setTimeout(saveHistory, 0)
  }, [saveHistory])

  // ── Image loading ─────────────────────────────────────────────────────────
  const loadImage = useCallback((file: File) => {
    if (file.size > 50 * 1024 * 1024) { toast('File too large — max 50 MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        const { w, h } = cszR.current
        const ir = img.naturalWidth / img.naturalHeight

        // Cover the trim area so no white gap appears at the print boundary
        const g = guides(cszR.current, ssR.current)
        const trimW = w - 2 * g.bx
        const trimH = h - 2 * g.by
        const tr    = trimW / trimH

        // Use Math.ceil so the image is always a whole pixel larger than the trim area —
        // this eliminates the sub-pixel gap that shows as a white hairline along the trim line.
        let imgW: number, imgH: number
        if (ir >= tr) {
          imgH = trimH
          imgW = Math.ceil(imgH * ir)
        } else {
          imgW = trimW
          imgH = Math.ceil(imgW / ir)
        }

        // Center over the trim area (integer-rounded so positions snap to whole pixels)
        const rawX = Math.round(g.bx + (trimW - imgW) / 2)
        const rawY = Math.round(g.by + (trimH - imgH) / 2)

        // Apply the SAME constraint used during drag so the initial placement
        // is already within bounds — no "jump" on first touch/drag.
        const bxPct    = g.bx / w
        const byPct    = g.by / h
        const trimRPct = (w - g.bx) / w
        const trimBPct = (h - g.by) / h
        const wPct     = imgW / w
        const hPct     = imgH / h
        const trimWPct = trimRPct - bxPct
        const trimHPct = trimBPct - byPct

        const minX = wPct >= trimWPct ? trimRPct - wPct : 0
        const maxX = wPct >= trimWPct ? bxPct            : 1 - wPct
        const minY = hPct >= trimHPct ? trimBPct - hPct  : 0
        const maxY = hPct >= trimHPct ? byPct             : 1 - hPct

        const xPct = Math.max(minX, Math.min(maxX, rawX / w))
        const yPct = Math.max(minY, Math.min(maxY, rawY / h))

        const id = uid()
        const el: DesignElement = {
          id, type: 'image',
          xPct, yPct, wPct, hPct,
          src, imgEl: img, naturalRatio: ir,
        }
        setElements(prev => [...prev.filter(e => e.type !== 'image'), el])
        setSelId(id)
        setTimeout(saveHistory, 0)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }, [saveHistory])

  // ── Finalize (exposed via ref) ────────────────────────────────────────────
  /** Renders a 300 DPI PNG, runs preflight, returns result. No download. */
  const finalize = useCallback(async (): Promise<FinalizeResult> => {
    const EMPTY: FinalizeResult = { dataUrl: '', pass: false, errors: [], warnings: [], preflightHash: '', designId: designIdRef.current }

    const canvas = canvasRef.current
    if (!canvas) return { ...EMPTY, errors: ['Canvas not ready'] }

    const p = parseSz(ssR.current)
    if (!p) return { ...EMPTY, errors: ['No product size selected — choose a size first.'] }

    // Commit any pending text edit and deselect
    if (editR.current) commitEdit()
    const prevSel = selRef.current
    setSelId(null)

    // Wait for React to flush, then draw clean canvas
    await new Promise<void>(res => {
      requestAnimationFrame(() => { draw(); requestAnimationFrame(() => res()) })
    })

    // Run preflight against current elements
    const pfResult = runPreflight(elRef.current, ssR.current)

    // Compute a stable hash of the design state for checkout verification
    const hashInput = JSON.stringify(elRef.current.map(e => ({
      id: e.id, type: e.type,
      x: Math.round(e.xPct * 1000), y: Math.round(e.yPct * 1000),
      w: Math.round(e.wPct * 1000), h: Math.round(e.hPct * 1000),
      text: e.text, src: e.src?.slice(-32),
    })))
    const preflightHash = btoa(unescape(encodeURIComponent(hashInput))).slice(-32)
    const designId = designIdRef.current

    // Hard stop on errors
    if (!pfResult.pass) {
      setSelId(prevSel)
      return { dataUrl: '', pass: false, errors: pfResult.errors, warnings: pfResult.warnings, preflightHash, designId }
    }

    // Build high-res off-screen canvas (full bleed area at 300 DPI)
    const fw = p.w + 2 * BLEED_IN, fh = p.h + 2 * BLEED_IN
    const expW = Math.round(fw * EXPORT_DPI)
    const expH = Math.round(fh * EXPORT_DPI)
    const sx = expW / canvas.width
    const sy = expH / canvas.height

    const offscreen = document.createElement('canvas')
    offscreen.width = expW; offscreen.height = expH
    const ctx = offscreen.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, expW, expH)

    const els = elRef.current
    const { w, h } = cszR.current
    for (const el of els) {
      const ex = el.xPct * w * sx, ey = el.yPct * h * sy
      const ew = el.wPct * w * sx, eh = el.hPct * h * sy
      if (el.type === 'image' && el.imgEl) {
        ctx.drawImage(el.imgEl, ex, ey, ew, eh)
      } else if (el.type === 'text' && el.text) {
        const fs = Math.round((el.fontSizePct ?? DEF_FSZ) * h * sy)
        ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${fs}px ${el.fontFamily || 'Arial, sans-serif'}`
        ctx.fillStyle = el.color || '#1a1a2e'; ctx.textBaseline = 'top'
        wrapText(ctx, el.text, ex + 2, ey + 3, ew - 4, fs * 1.35)
      }
    }

    // Crop marks at trim line
    const bleedPx = Math.round(BLEED_IN * EXPORT_DPI)
    const mk = 30
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([])
    const cropCorners: [number, number, number, number][] = [
      [bleedPx,        bleedPx,        -mk, -mk],
      [expW - bleedPx, bleedPx,         mk, -mk],
      [bleedPx,        expH - bleedPx, -mk,  mk],
      [expW - bleedPx, expH - bleedPx,  mk,  mk],
    ]
    for (const [cx, cy, ox, oy] of cropCorners) {
      ctx.beginPath(); ctx.moveTo(cx + ox, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + oy); ctx.stroke()
    }

    const dataUrl = offscreen.toDataURL('image/png')
    onDesignExport(dataUrl)
    setSelId(prevSel)

    // If a back-side design exists, render it too
    let backDataUrl: string | undefined
    const backEls = activeSide === 'front'
      ? savedSidesRef.current.back
      : savedSidesRef.current.front
    if (backEls.length > 0) {
      const offBack = document.createElement('canvas')
      offBack.width = expW; offBack.height = expH
      const bctx = offBack.getContext('2d')!
      bctx.fillStyle = '#ffffff'; bctx.fillRect(0, 0, expW, expH)
      for (const el of backEls) {
        const ex = el.xPct * w * sx, ey = el.yPct * h * sy
        const ew = el.wPct * w * sx, eh = el.hPct * h * sy
        if (el.type === 'image' && el.imgEl) {
          bctx.drawImage(el.imgEl, ex, ey, ew, eh)
        } else if (el.type === 'text' && el.text) {
          const fs = Math.round((el.fontSizePct ?? DEF_FSZ) * h * sy)
          bctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${fs}px ${el.fontFamily || 'Arial, sans-serif'}`
          bctx.fillStyle = el.color || '#1a1a2e'; bctx.textBaseline = 'top'
          wrapText(bctx, el.text, ex + 2, ey + 3, ew - 4, fs * 1.35)
        }
      }
      backDataUrl = offBack.toDataURL('image/png')
    }

    return { dataUrl, backDataUrl, pass: true, errors: [], warnings: pfResult.warnings, preflightHash, designId }
  }, [draw, commitEdit, onDesignExport, runPreflight, activeSide])

  // Expose finalize + hasContent to parent via ref
  useImperativeHandle(ref, () => ({
    finalize,
    hasContent: () =>
      elRef.current.length > 0 ||
      savedSidesRef.current.front.length > 0 ||
      savedSidesRef.current.back.length  > 0,
  }), [finalize])

  // ── Drag-and-drop onto canvas ─────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => e.preventDefault()
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) loadImage(f)
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  const selEl  = elements.find(el => el.id === selectedId)
  const isText  = selEl?.type === 'text'
  const isImage = selEl?.type === 'image'
  const parsed  = parseSz(selectedSize)
  const canUndo = histState.idx > 0
  const canRedo = histState.idx < histState.len - 1
  const hasIssues = preflightErrors.length > 0

  const toggleProp = (prop: 'bold' | 'italic') =>
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, [prop]: !el[prop as keyof DesignElement] } : el))

  const setTextColor = (color: string) =>
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, color } : el))

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3
                      bg-slate-50 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-tight">
              Design Editor
              <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                ${activeSide === 'front'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-slate-200 text-slate-600'}`}>
                {activeSide === 'front' ? 'Front' : 'Back'}
              </span>
            </h3>
            {selectedSize && parsed ? (
              <p className="text-[11px] text-muted-foreground">
                {parsed.w}" × {parsed.h}" + 0.125" bleed · 300 DPI print file
              </p>
            ) : (
              <p className="text-[11px] text-amber-600 font-medium">
                ↑ Select a size to activate the canvas
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={undo}
                  disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={redo}
                  disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo2 className="w-3.5 h-3.5" />
          </Button>

          {/* Preflight status badge */}
          {elements.length > 0 && (
            <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium
              ${hasIssues
                ? 'bg-red-100 text-red-700'
                : 'bg-emerald-100 text-emerald-700'}`}>
              {hasIssues
                ? <><AlertTriangle className="w-3 h-3" /> Fix issues</>
                : <><CheckCircle2 className="w-3 h-3" /> Ready</>
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Legend bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5
                      bg-slate-50/60 border-b border-border/20 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-0.5 bg-red-600/70" />
          <span>Trim line (cut here)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-0 border-t-2 border-blue-500" style={{ borderTopStyle: 'dashed' }} />
          <span>Safe area — keep text inside</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3.5 rounded-sm" style={{ background: '#fde8e8', border: '1px solid #fca5a5' }} />
          <span>Bleed zone 0.125"</span>
        </div>
      </div>

      {/* ── Tool bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2
                      border-b border-border/20 bg-white">

        {/* Front / Back side toggle */}
        <div className="flex items-center rounded-lg border border-border/60 overflow-hidden shrink-0">
          <button
            onClick={() => switchSide('front')}
            className={`px-3 h-8 text-xs font-semibold transition-colors ${
              activeSide === 'front'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white text-foreground/70 hover:bg-muted/60'
            }`}
          >
            ▣ Front
          </button>
          <button
            onClick={() => switchSide('back')}
            className={`px-3 h-8 text-xs font-semibold border-l border-border/60 transition-colors ${
              activeSide === 'back'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white text-foreground/70 hover:bg-muted/60'
            }`}
          >
            ▣ Back
            {savedSidesRef.current.back.length > 0 && activeSide !== 'back' && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block align-middle" />
            )}
          </button>
        </div>

        <div className="w-px h-5 bg-border/50 shrink-0" />

        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                onClick={() => fileInputRef.current?.click()}>
          {isImage ? <><RefreshCw className="w-3 h-3" />Replace</> : <><Upload className="w-3 h-3" />Upload Image</>}
        </Button>

        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addText}>
          <Type className="w-3 h-3" /> Add Text
        </Button>

        {/* Text controls */}
        {isText && !editingId && (
          <>
            <div className="w-px h-5 bg-border/60 mx-0.5" />
            <Button size="sm" variant={selEl?.bold   ? 'default' : 'outline'} className="h-8 w-8 p-0"
                    title="Bold" onClick={() => toggleProp('bold')}>
              <Bold className="w-3 h-3" />
            </Button>
            <Button size="sm" variant={selEl?.italic ? 'default' : 'outline'} className="h-8 w-8 p-0"
                    title="Italic" onClick={() => toggleProp('italic')}>
              <Italic className="w-3 h-3" />
            </Button>
            <label className="cursor-pointer" title="Text colour">
              <div className="flex items-center gap-1 h-8 px-2 text-xs border border-border
                              rounded-md hover:bg-muted/60 transition-colors">
                <Palette className="w-3 h-3 text-muted-foreground" />
                <div className="w-3.5 h-3.5 rounded-sm border border-border/50"
                     style={{ background: selEl?.color || '#1a1a2e' }} />
              </div>
              <input type="color" className="sr-only"
                     value={selEl?.color || '#1a1a2e'}
                     onChange={e => setTextColor(e.target.value)} />
            </label>
            {/* Font size input */}
            <div className="flex items-center gap-1 h-8">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Size:</span>
              <Input
                type="number" min="8" max="200"
                value={selEl ? Math.round((selEl.fontSizePct ?? DEF_FSZ) * cszR.current.h) : 24}
                onChange={(e) => {
                  const px = Math.max(8, Math.min(200, parseInt(e.target.value) || 24))
                  const fontSizePct = px / cszR.current.h
                  setElements(prev => prev.map(el =>
                    el.id === selectedId ? { ...el, fontSizePct } : el
                  ))
                }}
                onBlur={() => setTimeout(saveHistory, 0)}
                className="w-14 h-8 text-xs text-center border-border focus-visible:ring-1"
              />
              <span className="text-[10px] text-muted-foreground">px</span>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                    onClick={() => { setEditId(selectedId); setTextInput(selEl?.text || '') }}>
              <Type className="w-3 h-3" /> Edit
            </Button>
          </>
        )}

        {(isImage || isText) && !editingId && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-1">
            <Info className="w-3 h-3" />
            {isText ? 'Drag handles to resize · size field for font' : 'Drag corners to resize'}
          </span>
        )}

        {selectedId && !editingId && (
          <Button size="sm" variant="outline"
                  className="h-8 gap-1 text-xs text-destructive border-destructive/30
                             hover:bg-destructive/5 ml-auto"
                  onClick={() => deleteEl(selectedId)}>
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        )}
      </div>

      {/* ── Canvas area ───────────────────────────────────────────────── */}
      <div className="relative bg-gray-200 flex items-center justify-center p-3 lg:p-5"
           onDragOver={onDragOver} onDrop={onDrop}>

        {!selectedSize && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 rounded-b-2xl">
            <div className="text-center px-8 py-6">
              <div className="text-5xl mb-3">📐</div>
              <p className="font-semibold text-base">Select a size to begin</p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                The canvas appears at the exact print aspect ratio — a 16×9" product always
                looks wider than a 12×9" product.
              </p>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={csz.w}
          height={csz.h}
          className="block w-full max-w-full shadow-lg rounded"
          style={{ userSelect: 'none', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDblClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
      </div>

      {/* ── Preflight panel (shown when there are issues) ──────────────── */}
      {(preflightErrors.length > 0 || preflightWarnings.length > 0) && (
        <div className="px-4 py-3 border-t border-border/20 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Print Check
          </p>
          {preflightErrors.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50
                                    border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
          {preflightWarnings.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50
                                    border border-amber-200 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Text editing panel ────────────────────────────────────────── */}
      {editingId && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 border-t border-blue-100">
          <Type className="w-4 h-4 text-blue-500 mt-[9px] shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="text-xs font-semibold text-blue-700">
              Editing text — Enter to apply · Esc to cancel
            </p>
            <textarea
              autoFocus
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
                if (e.key === 'Escape') setEditId(null)
              }}
              rows={2}
              placeholder="Type your text here…"
              className="w-full text-sm border border-blue-200 rounded-xl p-2.5 resize-none
                         outline-none focus:border-blue-400 bg-white"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={commitEdit} className="bg-blue-600 hover:bg-blue-700 text-white">
                Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer tips ────────────────────────────────────────────────── */}
      {!editingId && (
        <div className="px-4 py-2 bg-slate-50 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
            <span>🖱️ <b>Click</b> to select</span>
            <span>↔️ <b>Drag</b> to move</span>
            <span>📐 <b>Handles</b> to resize</span>
            <span>✏️ <b>Double-tap/click</b> text to edit</span>
            <span>📱 <b>Touch-friendly</b></span>
            <span><span className="text-red-500">✕</span> to delete</span>
            <span>▣ <b>Front / Back</b> to switch sides</span>
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) loadImage(f); e.target.value = '' }} />
    </div>
  )
})

ProductDesigner.displayName = 'ProductDesigner'
export default ProductDesigner
