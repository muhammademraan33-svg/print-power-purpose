import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const wooCommerceUrl = Deno.env.get('WOOCOMMERCE_STORE_URL') || 'https://printpowerpurpose.com'
const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY') || 'ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192'
const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET') || 'cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const credentials = btoa(`${consumerKey}:${consumerSecret}`)

    // Fetch all products from WooCommerce
    let page = 1
    const perPage = 100
    let allProducts: any[] = []
    let hasMore = true

    while (hasMore) {
      const response = await fetch(
        `${wooCommerceUrl}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}`,
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.statusText}`)
      }

      const products: any[] = await response.json()
      allProducts = [...allProducts, ...products]

      hasMore = products.length === perPage
      page++
    }

    // Upsert products into database
    const results = []
    for (const product of allProducts) {
      // Skip if product is not published
      if (product.status !== 'publish') continue

      // Get primary image
      const imageUrl = product.images && product.images.length > 0 
        ? product.images[0].src 
        : null

      // Get additional images
      const additionalImages = product.images && product.images.length > 1
        ? product.images.slice(1).map((img: any) => img.src)
        : []

      // Get category (use first category)
      const category = product.categories && product.categories.length > 0
        ? product.categories[0].name
        : null

      // Convert price to cents
      const baseCostCents = product.regular_price
        ? Math.round(parseFloat(product.regular_price) * 100)
        : null

      const { data, error } = await supabase
        .from('products')
        .upsert({
          vendor: 'woocommerce',
          vendor_product_id: product.id.toString(),
          name: product.name,
          description: product.description || null,
          category: category || null,
          sku: product.sku || null,
          image_url: imageUrl,
          additional_images: additionalImages.length > 0 ? additionalImages : null,
          base_cost_cents: baseCostCents,
          retail_price_cents: baseCostCents, // WooCommerce price is already retail
          is_active: product.status === 'publish',
          is_featured: product.featured || false,
          metadata: {
            type: product.type,
            variations: product.variations || [],
            attributes: product.attributes || [],
            categories: product.categories || [],
            tags: product.tags || [],
            permalink: product.permalink,
            stock_status: product.stock_status,
            manage_stock: product.manage_stock,
            stock_quantity: product.stock_quantity,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'vendor,vendor_product_id',
        })
        .select()
        .single()

      if (error) {
        console.error(`Error upserting product ${product.name}:`, error)
      } else {
        results.push({ id: data.id, name: product.name })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: allProducts.length,
        synced: results.length,
        products: results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to sync products' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
