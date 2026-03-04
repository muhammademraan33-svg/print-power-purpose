import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PUB78_URL = 'https://apps.irs.gov/pub/epostcard/data-download-pub78.zip'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Download ZIP file
    console.log('Downloading Pub78 ZIP...')
    const zipResponse = await fetch(PUB78_URL)
    if (!zipResponse.ok) {
      throw new Error(`Failed to download Pub78 ZIP: ${zipResponse.statusText}`)
    }

    // Download ZIP and extract
    // Note: Deno doesn't have built-in ZIP support, so we'll use a workaround
    // The IRS Pub78 ZIP typically contains a single text file
    // For production, consider using: https://deno.land/x/zipjs@v2.7.29/index.ts
    // or install via: deno add npm:jszip
    
    const zipArrayBuffer = await zipResponse.arrayBuffer()
    
    // Try to use JSZip if available, otherwise use manual extraction
    // For now, we'll attempt to parse the ZIP manually or use a library
    let textContent = ''
    
    try {
      // Try using JSZip if available (install via: deno add npm:jszip)
      // @ts-ignore - JSZip may not be available
      const JSZip = await import('npm:jszip')
      const zip = await JSZip.loadAsync(zipArrayBuffer)
      
      // Find the data file (usually .txt or largest file)
      let dataFile: any = null
      for (const [fileName, file] of Object.entries(zip.files)) {
        if (fileName.endsWith('.txt') || !fileName.includes('.')) {
          if (!dataFile || file._data?.uncompressedSize > (dataFile._data?.uncompressedSize || 0)) {
            dataFile = file
          }
        }
      }
      
      if (dataFile) {
        textContent = await dataFile.async('string')
      } else {
        throw new Error('No data file found in ZIP')
      }
    } catch (zipError) {
      // Fallback: Try to parse as if it's already text (for testing)
      console.warn('ZIP extraction failed, trying direct parse:', zipError)
      const textDecoder = new TextDecoder('utf-8', { fatal: false })
      textContent = textDecoder.decode(new Uint8Array(zipArrayBuffer))
      
      // If it doesn't look like text, throw error
      if (!textContent.includes('|')) {
        throw new Error('Failed to extract ZIP file. Please install JSZip: deno add npm:jszip')
      }
    }
    const lines = textContent.split('\n').filter(line => line.trim())
    
    console.log(`Found ${lines.length} lines to process`)

    const nonprofits: Array<{
      ein: string
      name: string
      city: string
      state: string
      category?: string
      is_verified: boolean
      is_active: boolean
    }> = []
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      const parts = line.split('|')
      if (parts.length < 5) continue
      
      const [ein, name, city, state, country, status] = parts
      
      if (!ein || !name) continue
      
      nonprofits.push({
        ein: ein.trim(),
        name: name.trim(),
        city: city?.trim() || '',
        state: state?.trim() || '',
        category: status?.trim() || undefined,
        is_verified: true,
        is_active: true,
      })
    }

    console.log(`Parsed ${nonprofits.length} nonprofits`)

    // Batch insert (upsert by EIN)
    const batchSize = 1000
    let inserted = 0
    let updated = 0
    let errors = 0

    for (let i = 0; i < nonprofits.length; i += batchSize) {
      const batch = nonprofits.slice(i, i + batchSize)
      
      try {
        const { data, error } = await supabase
          .from('nonprofits')
          .upsert(batch, { 
            onConflict: 'ein',
            ignoreDuplicates: false,
          })
          .select()

        if (error) {
          console.error(`Batch ${i / batchSize + 1} error:`, error)
          errors += batch.length
        } else {
          inserted += data?.length || 0
        }
      } catch (batchError) {
        console.error(`Batch ${i / batchSize + 1} exception:`, batchError)
        errors += batch.length
      }

      // Progress update every 10 batches
      if ((i / batchSize) % 10 === 0) {
        console.log(`Processed ${i + batch.length} / ${nonprofits.length} nonprofits`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: nonprofits.length,
        processed: inserted,
        errors,
        message: `Imported ${inserted} nonprofits from IRS Pub78`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Pub78 import error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to import Pub78 data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
