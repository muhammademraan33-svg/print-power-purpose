import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// SinaLite API credentials (Sandbox/Test - from conversation)
const sinaliteClientId = Deno.env.get('SINALITE_CLIENT_ID_TEST') || Deno.env.get('SINALITE_CLIENT_ID_LIVE') || 'jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H'
const sinaliteClientSecret = Deno.env.get('SINALITE_CLIENT_SECRET_TEST') || Deno.env.get('SINALITE_CLIENT_SECRET_LIVE') || 'nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b'
const sinaliteAudience = Deno.env.get('SINALITE_AUDIENCE_TEST') || Deno.env.get('SINALITE_AUDIENCE_LIVE') || 'https://apiconnect.sinalite.com'
const sinaliteAuthUrl = Deno.env.get('SINALITE_AUTH_URL_TEST') || Deno.env.get('SINALITE_AUTH_URL_LIVE') || 'https://api.sinaliteuppy.com'
const sinaliteApiUrl = Deno.env.get('SINALITE_API_URL_TEST') || Deno.env.get('SINALITE_API_URL_LIVE') || 'https://api.sinaliteuppy.com'

async function getSinaLiteToken(): Promise<string> {
  const response = await fetch(`${sinaliteAuthUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: sinaliteClientId,
      client_secret: sinaliteClientSecret,
      audience: sinaliteAudience,
    }),
  })

  if (!response.ok) {
    throw new Error(`SinaLite auth failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function scrapeProductImage(productName: string, productId?: string): Promise<string | null> {
  try {
    // Search SinaLite.com for the product
    const searchUrl = `https://sinalite.com/en_us/catalogsearch/result/?q=${encodeURIComponent(productName)}`
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch search page for ${productName}`)
      return null
    }

    const html = await response.text()

    // Try to find product page link
    // Look for product links in search results
    const productLinkMatch = html.match(/href="([^"]*\/[^"]*\.html)"/g)
    if (!productLinkMatch || productLinkMatch.length === 0) {
      console.error(`No product links found for ${productName}`)
      return null
    }

    // Get the first product link
    let productUrl = productLinkMatch[0].replace('href="', '').replace('"', '')
    if (!productUrl.startsWith('http')) {
      productUrl = `https://sinalite.com${productUrl}`
    }

    // Fetch the product page
    const productResponse = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!productResponse.ok) {
      console.error(`Failed to fetch product page: ${productUrl}`)
      return null
    }

    const productHtml = await productResponse.text()

    // Try to extract image from og:image meta tag
    const ogImageMatch = productHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    if (ogImageMatch && ogImageMatch[1]) {
      const imageUrl = ogImageMatch[1]
      // Only accept product-level images, not category icons
      if (imageUrl.includes('/media/catalog/product/') && !imageUrl.includes('/media/catalog/category/')) {
        return imageUrl
      }
    }

    // Try to find image in product gallery
    const galleryImageMatch = productHtml.match(/<img[^>]*class="[^"]*gallery[^"]*"[^>]*src="([^"]+)"/i)
    if (galleryImageMatch && galleryImageMatch[1]) {
      const imageUrl = galleryImageMatch[1]
      if (imageUrl.includes('/media/catalog/product/') && !imageUrl.includes('/media/catalog/category/')) {
        return imageUrl.startsWith('http') ? imageUrl : `https://sinalite.com${imageUrl}`
      }
    }

    // Try to find main product image
    const mainImageMatch = productHtml.match(/<img[^>]*id="main-product-image"[^>]*src="([^"]+)"/i) ||
                         productHtml.match(/<img[^>]*class="[^"]*product-image[^"]*"[^>]*src="([^"]+)"/i)
    if (mainImageMatch && mainImageMatch[1]) {
      const imageUrl = mainImageMatch[1]
      if (imageUrl.includes('/media/catalog/product/') && !imageUrl.includes('/media/catalog/category/')) {
        return imageUrl.startsWith('http') ? imageUrl : `https://sinalite.com${imageUrl}`
      }
    }

    console.error(`No valid product image found for ${productName}`)
    return null
  } catch (error) {
    console.error(`Error scraping image for ${productName}:`, error)
    return null
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { productId, batch = false } = await req.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (batch) {
      // Batch mode: sync images for all products missing images
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, vendor_product_id, image_url')
        .or('image_url.is.null,image_url.eq.')
        .eq('vendor', 'sinalite')
        .limit(50) // Process in batches

      if (error) throw error

      const results = []
      for (const product of products || []) {
        if (product.image_url) continue

        const imageUrl = await scrapeProductImage(product.name, product.vendor_product_id)
        if (imageUrl) {
          await supabase
            .from('products')
            .update({ image_url: imageUrl })
            .eq('id', product.id)
          results.push({ productId: product.id, name: product.name, imageUrl })
        }

        // Rate limiting: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: results.length,
          results,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else {
      // Single product mode
      if (!productId) {
        return new Response(JSON.stringify({ error: 'Product ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Get product from database
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, vendor_product_id, image_url')
        .eq('id', productId)
        .single()

      if (productError || !product) {
        return new Response(JSON.stringify({ error: 'Product not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Scrape image
      const imageUrl = await scrapeProductImage(product.name, product.vendor_product_id)

      if (imageUrl) {
        // Update product with image URL
        const { error: updateError } = await supabase
          .from('products')
          .update({ image_url: imageUrl })
          .eq('id', productId)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({
            success: true,
            productId,
            imageUrl,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            productId,
            message: 'Image not found',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }
  } catch (error) {
    console.error('Image sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to sync images' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
