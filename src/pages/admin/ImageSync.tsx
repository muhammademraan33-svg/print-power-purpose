import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/toaster'

export default function ImageSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleSyncProducts = async () => {
    setIsSyncing(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-sinalite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      if (data.success) {
        toast(`Synced ${data.synced} products from SinaLite`, 'success')
        setResults(data)
      } else {
        throw new Error(data.error || 'Sync failed')
      }
    } catch (error: any) {
      toast(error.message || 'Failed to sync products', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleScrapeImages = async () => {
    setIsScraping(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-sinalite-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true }),
      })

      const data = await response.json()
      if (data.success) {
        toast(`Scraped images for ${data.processed} products`, 'success')
        setResults(data)
      } else {
        throw new Error(data.error || 'Image scraping failed')
      }
    } catch (error: any) {
      toast(error.message || 'Failed to scrape images', 'error')
    } finally {
      setIsScraping(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-serif font-bold mb-8">SinaLite Product Sync</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync Products
            </CardTitle>
            <CardDescription>
              Fetch all products from SinaLite API and sync to database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSyncProducts}
              disabled={isSyncing}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                'Sync Products from SinaLite'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Scrape Product Images
            </CardTitle>
            <CardDescription>
              Scrape product images from SinaLite.com for products missing images
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleScrapeImages}
              disabled={isScraping}
              variant="outline"
              className="w-full"
            >
              {isScraping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping Images...
                </>
              ) : (
                'Scrape Images from SinaLite.com'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(results, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Image scraping may take time (1 second delay between requests to avoid rate limiting)</p>
          <p>• Only product-level images are accepted (not category icons)</p>
          <p>• Images are scraped from SinaLite.com product pages</p>
          <p>• Batch processing handles 50 products at a time</p>
        </CardContent>
      </Card>
    </div>
  )
}
