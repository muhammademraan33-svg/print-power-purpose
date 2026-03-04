import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface ProductDesignerProps {
  productId: number | string
  onDesignExport: (url: string) => void
}

declare global {
  interface Window {
    FancyProductDesigner: any
    __fpdScriptLoaded?: boolean
  }
}

// ─── Load the FPD script exactly once for the entire page lifetime ─────────────
// React 18 Strict Mode double-invokes effects; we use a module-level promise so
// the <script> tag is never injected twice and Custom Elements are never re-registered.
let fpdLoadPromise: Promise<void> | null = null

function loadFPD(): Promise<void> {
  if (fpdLoadPromise) return fpdLoadPromise

  fpdLoadPromise = new Promise<void>((resolve, reject) => {
    // If FPD is already on window (e.g. after HMR) just resolve immediately
    if (window.FancyProductDesigner) {
      resolve()
      return
    }

    // Inject CSS once
    if (!document.querySelector('link[href="/fpd/FancyProductDesigner-all.min.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/fpd/FancyProductDesigner-all.min.css'
      document.head.appendChild(link)
    }

    // Inject JS once
    if (!document.querySelector('script[src="/fpd/FancyProductDesigner-all.min.js"]')) {
      const script = document.createElement('script')
      script.src = '/fpd/FancyProductDesigner-all.min.js'
      script.onload = () => resolve()
      script.onerror = () => {
        fpdLoadPromise = null // allow retry
        reject(new Error('Failed to load FancyProductDesigner script'))
      }
      document.body.appendChild(script)
    } else {
      // Script tag present but might still be loading — poll for window.FancyProductDesigner
      const interval = setInterval(() => {
        if (window.FancyProductDesigner) {
          clearInterval(interval)
          resolve()
        }
      }, 100)
    }
  })

  return fpdLoadPromise
}

export default function ProductDesigner({ productId, onDesignExport }: ProductDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ── Load the script once, then initialise FPD ────────────────────────────────
  useEffect(() => {
    let cancelled = false

    loadFPD()
      .then(() => {
        if (cancelled) return
        setIsLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        console.error('FPD load error:', err)
        setLoadError('Could not load the product designer. Please refresh.')
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  // ── Initialise FPD once the script is ready and the container is mounted ──────
  useEffect(() => {
    let cancelled = false

    if (isLoading || isInitialized || loadError) return
    if (!containerRef.current || !window.FancyProductDesigner) return
    // Prevent double-init (React 18 Strict Mode second call)
    if (instanceRef.current) return

    try {
      // ── CRITICAL: disable server-side upload mode ────────────────────────────────
      // FancyProductDesigner.uploadsToServer defaults to TRUE (static class prop).
      // When true it demands fileServerURL be set — without it FPD shows:
      //   "You need to set the fileServerURL in the option, otherwise file
      //    uploading does not work!"
      // Setting it to false makes FPD work entirely client-side: images are read
      // locally via FileReader and added straight to the canvas. We export the
      // finished design ourselves via getProductDataURL().
      window.FancyProductDesigner.uploadsToServer = false

      // ── productsJSON format (critical!) ─────────────────────────────────────────
      // FPD expects productsJSON as an **array of products**, where each product is
      // itself an **array of view objects** (NOT an object with a "views" key).
      // Passing {title, views:[...]} caused "t.forEach is not a function" because
      // FPD tried to call .forEach() on the product object.
      // Correct format: [ [ {title:'Front', thumbnail:'', elements:[]} ] ]
      //                   ^product 1 (array) ^view 1 (object)
      const fpd = new window.FancyProductDesigner(containerRef.current, {
        stageWidth: 900,
        stageHeight: 550,
        mainBarModules: ['products', 'images', 'text', 'designs'],
        actions: {
          left: ['preview-lightbox'],
          center: ['undo', 'redo'],
          right: ['info'],
        },
        customImageUpload: true,
        // Nested-array format — each product is an array of view objects
        productsJSON: [
          [
            { title: 'Front', thumbnail: '', elements: [] },
          ],
        ],
      })

      instanceRef.current = fpd

      // 'ready' fires after FPD completes setupProducts + font loading.
      // At this point the canvas is live; we just mark state as initialized.
      fpd.addEventListener('ready', () => {
        if (cancelled) return
        setIsInitialized(true)
      })

      // Fallback: if 'ready' is missed (e.g. fired synchronously), check after a tick
      setTimeout(() => {
        if (!cancelled && instanceRef.current && !isInitialized) {
          setIsInitialized(true)
        }
      }, 3000)
    } catch (error) {
      console.error('Error initializing FPD:', error)
      if (!cancelled) setLoadError('Designer failed to initialize. Try refreshing the page.')
    }

    return () => { cancelled = true }
  }, [isLoading, isInitialized, loadError])

  const handleExport = async () => {
    if (!instanceRef.current) return

    try {
      // Get design as data URL (high-res)
      instanceRef.current.getProductDataURL((dataURL: string) => {
        // Convert data URL to blob
        fetch(dataURL)
          .then(res => res.blob())
          .then(async (blob) => {
            // Upload to Supabase Storage
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            const fileName = `design-${productId}-${Date.now()}.png`

            const response = await fetch(`${supabaseUrl}/functions/v1/upload-artwork`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName,
                fileType: 'image/png',
              }),
            })

            const { uploadUrl, filePath } = await response.json()

            // Upload file
            await fetch(uploadUrl, {
              method: 'PUT',
              body: blob,
              headers: { 'Content-Type': 'image/png' },
            })

            // Get public URL
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/artwork/${filePath}`
            onDesignExport(publicUrl)
          })
      })
    } catch (error) {
      console.error('Error exporting design:', error)
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-destructive text-sm">{loadError}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customize Your Design</CardTitle>
        <CardDescription>
          Add text, upload images, or draw directly on the canvas. Click "Export Design" when finished.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* FPD mounts itself inside this div */}
        {/* overflow-visible so FPD toolbars/dropdowns are not clipped */}
        <div
          ref={containerRef}
          className="min-h-[550px] bg-muted rounded-lg relative"
          style={{ minHeight: 550 }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading designer…</span>
            </div>
          )}
        </div>
        {isInitialized && (
          <Button onClick={handleExport} className="mt-4 w-full">
            Export Design
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
