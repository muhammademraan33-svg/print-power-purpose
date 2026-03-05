/**
 * ProductDesigner.tsx  —  Vistaprint-inspired canvas designer
 *
 * Canvas layout (mirrors industry-standard print specs):
 *  ┌─────────────────────────────────────┐  ← canvas edge (full bleed area)
 *  │ ░░░░ BLEED ZONE (0.125") ░░░░░░░░  │
 *  │ ░ ┌─────────────────────────────┐ ░│  ← TRIM LINE — where product is cut
 *  │ ░ │ · · · SAFE AREA  · · · · · │ ░│  ← SAFE AREA GUIDE (dashed)
 *  │ ░ │ ·                         · │ ░│
 *  │ ░ │ ·      DESIGN AREA        · │ ░│
 *  │ ░ │ · · · · · · · · · · · · · · │ ░│
 *  │ ░ └─────────────────────────────┘ ░│
 *  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 *  └─────────────────────────────────────┘
 *
 * Ratio technique: selecting "16 x 9" always gives a wider canvas than "12 x 9".
 * The client confirmed: "Yes ratio works."
 *
 * Features:
 *  • Correct aspect ratio per selected size (+ bleed)
 *  • Bleed zone (pink) · Trim line (solid red) · Safe area (dashed blue)
 *  • Image upload, drag-to-move, 8-handle resize, replace, delete
 *  • Text add, drag-to-move, bold/italic/colour, inline editing
 *  • Undo / Redo (5-level history)
 *  • 300 DPI high-res PNG export with crop marks
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Upload, Type, Trash2, Download, Bold, Italic,
  Palette, RefreshCw, Layers, Undo2, Redo2, Info,
} from 'lucide-react'
import { toast } from '@/components/ui/toaster'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DesignElement {
  id: string
  type: 'image' | 'text'
  /** Position + size as fraction of canvas width/height (0–1).
   *  Stored proportionally so they survive aspect-ratio changes. */
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

interface Props {
  productId: number | string
  onDesignExport: (dataUrl: string) => void
  /** e.g. "3.5 x 2" — drives canvas aspect ratio  */
  selectedSize?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_W      = 580   // max canvas display width
const MAX_H      = 460   // max canvas display height
const BLEED_IN   = 0.125 // 0.125" bleed (industry standard)
const SAFE_IN    = 0.125 // 0.125" safe margin inside trim
const H          = 8     // handle square half-size
const DEF_FSZ    = 0.06  // default font = 6% of canvas height
const EXPORT_DPI = 300   // high-res export resolution
const MAX_HIST   = 20    // history depth

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4)

function parseSz(s?: string): { w: number; h: number } | null {
  if (!s) return null
  const m = s.match(/([\d.]+)\s*[xX×]\s*([\d.]+)/)
  if (!m) return null
  const w = parseFloat(m[1]), h = parseFloat(m[2])
  return (w > 0 && h > 0) ? { w, h } : null
}

/** Canvas pixel dimensions for the FULL BLEED area (product + 0.125" on each side). */
function calcCsz(sizeStr?: string): { w: number; h: number } {
  const p = parseSz(sizeStr)
  if (!p) return { w: MAX_W, h: Math.round(MAX_W * 0.625) }
  const fw = p.w + 2 * BLEED_IN, fh = p.h + 2 * BLEED_IN
  const ratio = fw / fh
  return ratio >= MAX_W / MAX_H
    ? { w: MAX_W,                             h: Math.max(80, Math.round(MAX_W / ratio)) }
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

export default function ProductDesigner({ productId: _pid, onDesignExport, selectedSize }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cursorRef    = useRef('default')

  const [csz, setCsz]             = useState(() => calcCsz(selectedSize))
  const [elements, setElements]   = useState<DesignElement[]>([])
  const [selectedId, setSelId]    = useState<string | null>(null)
  const [interaction, setIa]      = useState<Interaction | null>(null)
  const [editingId, setEditId]    = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')

  // Undo / Redo
  const histRef    = useRef<DesignElement[][]>([[]])
  const histIdxRef = useRef(0)
  const [histState, setHistState] = useState({ idx: 0, len: 1 }) // for button disabled state

  // Stable refs — always hold the latest state for the draw callback
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

    // ── 2. Elements ───────────────────────────────────────────────────────
    for (const el of els) {
      const ex = el.xPct * w, ey = el.yPct * h
      const ew = el.wPct * w, eh = el.hPct * h

      if (el.type === 'image' && el.imgEl) {
        ctx.drawImage(el.imgEl, ex, ey, ew, eh)

      } else if (el.type === 'text') {
        const dispText = (el.id === editing ? liveText : el.text) || ''
        const fs = Math.round((el.fontSizePct ?? DEF_FSZ) * h)

        if (el.id === editing) {
          // Show dashed edit box + transparent fill while user types
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
        // Selection border
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([])
        ctx.strokeRect(ex - 1, ey - 1, ew + 2, eh + 2)

        // 8 resize handles for BOTH images and text
        const hp = handlePositions(el, cszR.current)
        const handleList = Object.entries(hp) as [string, [number, number]][]

        for (const [, [hx, hy]] of handleList) {
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5
          ctx.fillRect(hx - H, hy - H, H * 2, H * 2)
          ctx.strokeRect(hx - H, hy - H, H * 2, H * 2)
        }

        // Delete button — red circle top-right
        const dbx = ex + ew + 10, dby = ey - 10
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(dbx, dby, 10, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('✕', dbx, dby)
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      }
    }

    // ── 3. Trim line (solid dark red) — where product is cut ─────────────
    ctx.strokeStyle = 'rgba(160,0,0,0.65)'; ctx.lineWidth = 1; ctx.setLineDash([])
    ctx.strokeRect(g.bx, g.by, w - 2 * g.bx, h - 2 * g.by)

    // Crop-mark corners (L-shaped ticks just outside trim line)
    const mk = 5
    ctx.strokeStyle = 'rgba(120,0,0,0.6)'; ctx.lineWidth = 1
    const corners: [number, number, number, number][] = [
      [g.bx, g.by,     -mk, -mk],  // TL
      [w - g.bx, g.by,  mk, -mk],  // TR
      [g.bx, h - g.by, -mk,  mk],  // BL
      [w - g.bx, h - g.by, mk, mk], // BR
    ]
    for (const [cx, cy, ox, oy] of corners) {
      ctx.beginPath(); ctx.moveTo(cx + ox, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + oy); ctx.stroke()
    }

    // ── 4. Safe area guide (dashed blue) ─────────────────────────────────
    ctx.strokeStyle = 'rgba(59,130,246,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4])
    ctx.strokeRect(g.sx, g.sy, w - 2 * g.sx, h - 2 * g.sy)
    ctx.setLineDash([])

    // ── 5. Zone labels ────────────────────────────────────────────────────
    ctx.font = '9px Arial'; ctx.textBaseline = 'top'
    // Safe area label (top-left corner, inside dashed rect)
    ctx.fillStyle = 'rgba(59,130,246,0.65)'
    ctx.fillText('Safe area', g.sx + 4, g.sy + 3)
    // Bleed zone label (top-left, in the pink strip)
    ctx.fillStyle = 'rgba(180,0,0,0.5)'
    ctx.fillText('← Bleed (0.125")', g.bx + 2, 2)

    // ── 6. Size watermark (bottom-right) ─────────────────────────────────
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

  // Trigger draw on any state change
  useEffect(() => { draw() }, [draw, elements, selectedId, editingId, textInput, csz, selectedSize])

  // ── Canvas coords (accounts for CSS scaling) ──────────────────────────────
  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (c.width  / r.width),
      y: (e.clientY - r.top)  * (c.height / r.height),
    }
  }

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

  // ── Mouse down ────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e)
    const curSel = selRef.current

    // 1. Delete button?
    if (curSel) {
      const sel = elRef.current.find(el => el.id === curSel)
      if (sel && hitDelete(x, y, sel)) { deleteEl(sel.id); return }
      // 2. Resize handle?
      if (sel) {
        const rh = hitHandle(x, y, sel)
        if (rh) {
          setIa({ id: sel.id, action: `resize-${rh}`, startMouseX: x, startMouseY: y,
                  startXPct: sel.xPct, startYPct: sel.yPct, startWPct: sel.wPct, startHPct: sel.hPct })
          return
        }
      }
    }

    // 3. Hit an element? → drag
    const hit = hitEl(x, y)
    if (hit) {
      setSelId(hit.id)
      setIa({ id: hit.id, action: 'drag', startMouseX: x, startMouseY: y,
               startXPct: hit.xPct, startYPct: hit.yPct, startWPct: hit.wPct, startHPct: hit.hPct })
    } else {
      setSelId(null)
      if (editR.current) commitEdit()
    }
  }

  // ── Mouse move ────────────────────────────────────────────────────────────
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e)
    const ia = iaR.current

    if (ia) {
      // Ongoing interaction — update element
      const { w, h } = cszR.current
      const dx = (x - ia.startMouseX) / w
      const dy = (y - ia.startMouseY) / h
      const MIN = 0.03

      setElements(prev => prev.map(el => {
        if (el.id !== ia.id) return el
        if (ia.action === 'drag') {
          return {
            ...el,
            xPct: Math.max(-0.15, Math.min(0.97, ia.startXPct + dx)),
            yPct: Math.max(-0.05, Math.min(0.97, ia.startYPct + dy)),
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
        // Clamp min size
        if (wp < MIN) { if (ia.action.includes('w')) xp = ia.startXPct + ia.startWPct - MIN; wp = MIN }
        if (hp < MIN) { if (ia.action.includes('n')) yp = ia.startYPct + ia.startHPct - MIN; hp = MIN }
        return { ...el, xPct: xp, yPct: yp, wPct: wp, hPct: hp }
      }))

    } else {
      // Update cursor (no active interaction)
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
  }

  const onMouseUp = useCallback(() => {
    if (iaR.current) saveHistory()
    setIa(null)
    if (canvasRef.current) canvasRef.current.style.cursor = cursorRef.current = 'default'
  }, [saveHistory])

  const onDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e)
    const hit = hitEl(x, y)
    if (hit?.type === 'text') { setEditId(hit.id); setTextInput(hit.text || ''); setSelId(hit.id) }
  }

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
        const ir = img.naturalWidth / img.naturalHeight   // image ratio
        const cr = w / h                                  // canvas ratio
        // Fit at 90%, maintaining image aspect ratio
        let wp: number, hp: number
        if (ir > cr) { wp = 0.90; hp = wp * cr / ir }
        else         { hp = 0.90; wp = hp * ir / cr }
        const id = uid()
        const el: DesignElement = {
          id, type: 'image',
          xPct: (1 - wp) / 2, yPct: (1 - hp) / 2, wPct: wp, hPct: hp,
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

  // ── High-res export (300 DPI PNG + crop marks) ───────────────────────────
  const exportDesign = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const p = parseSz(ssR.current)
    if (!p) { toast('Please select a size before exporting', 'error'); return }

    // Deselect + commit edits before rendering
    const prevSel = selRef.current
    if (editR.current) commitEdit()
    setSelId(null)

    // Use requestAnimationFrame to let React flush the selection change
    requestAnimationFrame(() => {
      draw()
      requestAnimationFrame(() => {
        // Build high-res off-screen canvas
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
        const mk = 30  // crop mark length in export pixels
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([])
        const cropCorners: [number, number, number, number][] = [
          [bleedPx, bleedPx, -mk, -mk],
          [expW - bleedPx, bleedPx, mk, -mk],
          [bleedPx, expH - bleedPx, -mk, mk],
          [expW - bleedPx, expH - bleedPx, mk, mk],
        ]
        for (const [cx, cy, ox, oy] of cropCorners) {
          ctx.beginPath(); ctx.moveTo(cx + ox, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + oy); ctx.stroke()
        }

        const url = offscreen.toDataURL('image/png')
        onDesignExport(url)

        // Trigger browser download
        const a = document.createElement('a')
        a.href = url
        a.download = `design-300dpi-${Date.now()}.png`
        a.click()

        toast(`Exported at 300 DPI — ${expW}×${expH}px print-ready file`, 'success')
        setSelId(prevSel)
      })
    })
  }, [draw, commitEdit, onDesignExport])

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

  const toggleProp = (prop: 'bold' | 'italic') =>
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, [prop]: !el[prop as keyof DesignElement] } : el))

  const setTextColor = (color: string) =>
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, color } : el))

  return (
    <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3
                      bg-slate-50 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-tight">Design Editor</h3>
            {selectedSize && parsed ? (
              <p className="text-[11px] text-muted-foreground">
                {parsed.w}" × {parsed.h}" + 0.125" bleed · 300 DPI export
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
          <div className="w-px h-5 bg-border/60 mx-0.5" />
          <Button size="sm" onClick={exportDesign}
                  className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-3.5 h-3.5" />
            Export 300 DPI
          </Button>
        </div>
      </div>

      {/* ── Legend bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5
                      bg-slate-50/60 border-b border-border/20 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-0.5 bg-red-600/70" />
          <span>Trim line (where it cuts)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-0 border-t border-blue-400" style={{ borderTopStyle: 'dashed' }} />
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

        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                onClick={() => fileInputRef.current?.click()}>
          {isImage ? <><RefreshCw className="w-3 h-3" />Replace</> : <><Upload className="w-3 h-3" />Upload Image</>}
        </Button>

        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addText}>
          <Type className="w-3 h-3" /> Add Text
        </Button>

        {/* Text controls (only when text is selected and NOT editing) */}
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
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                    onClick={() => { setEditId(selectedId); setTextInput(selEl?.text || '') }}>
              <Type className="w-3 h-3" /> Edit Text
            </Button>
          </>
        )}

        {/* Image info tip */}
        {isImage && !editingId && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-1">
            <Info className="w-3 h-3" /> Drag corners to resize
          </span>
        )}

        {/* Delete (only when something selected) */}
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

        {/* Overlay until a size is selected */}
        {!selectedSize && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 rounded-b-2xl">
            <div className="text-center px-8 py-6">
              <div className="text-5xl mb-3">📐</div>
              <p className="font-semibold text-base">Select a size to begin</p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                The canvas will appear at the exact print aspect ratio — a 16×9" product will
                always look wider than a 12×9" product.
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
        />
      </div>

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
            <span>📐 <b>Corner handles</b> to resize images</span>
            <span>✏️ <b>Double-click</b> text to edit</span>
            <span><span className="text-red-500">✕</span> button to delete</span>
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) loadImage(f); e.target.value = '' }} />
    </div>
  )
}
