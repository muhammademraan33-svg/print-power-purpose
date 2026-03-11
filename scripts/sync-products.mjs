/**
 * sync-products.mjs
 * Fetches all products from SinaLite API + Printify API
 * and saves them to src/data/sinaliteProducts.json
 *
 * Usage: node scripts/sync-products.mjs
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = join(__dirname, '../src/data/sinaliteProducts.json')

// ── Load .env file manually (Node doesn't auto-load it) ─────────────────────
function loadEnv() {
  const envPath = join(__dirname, '../.env')
  if (!existsSync(envPath)) return {}
  const vars = {}
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    vars[key] = val
  }
  return vars
}
const envVars = loadEnv()

// ── SinaLite credentials ────────────────────────────────────────────────────
const SINALITE_CLIENT_ID     = process.env.SINALITE_CLIENT_ID || envVars.VITE_SINALITE_CLIENT_ID || 'jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H'
const SINALITE_CLIENT_SECRET = process.env.SINALITE_CLIENT_SECRET || envVars.VITE_SINALITE_CLIENT_SECRET || 'nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b'
const SINALITE_AUDIENCE      = process.env.SINALITE_AUDIENCE || envVars.VITE_SINALITE_AUDIENCE || 'https://apiconnect.sinalite.com'
const SINALITE_AUTH_URL      = process.env.SINALITE_AUTH_URL || envVars.VITE_SINALITE_AUTH_URL || 'https://api.sinaliteuppy.com'
const SINALITE_API_URL       = process.env.SINALITE_API_URL || envVars.VITE_SINALITE_API_URL || 'https://api.sinaliteuppy.com'

// ── Printify credentials ─────────────────────────────────────────────────────
// Reads from: CLI env var → .env PRINTIFY_API_KEY → .env VITE_PRINTIFY_API_KEY
const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY
  || envVars.PRINTIFY_API_KEY
  || envVars.VITE_PRINTIFY_API_KEY
  || ''

// ── Category → Image mapping (high quality Unsplash photos) ─────────────────
const CATEGORY_IMAGES = {
  'Business Cards':               'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&q=80',
  'Folded Business Cards':        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&q=80',
  'Specialty Business Cards':     'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&q=80',
  'Flyers':                       'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
  'Brochures':                    'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
  'Brochure Enveloped and Addressed': 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
  'Postcards':                    'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80',
  'Postcard Addressed':           'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80',
  'Postcard Enveloped and Addressed': 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80',
  'Specialty Post Cards':         'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80',
  'Posters':                      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80',
  'Large Format Posters':         'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80',
  'Banners':                      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'Vinyl Banners':                'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'Pull Up Banners':              'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'Pull Up Banners-':             'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'X-Frame Banners':              'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'Booklets':                     'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80',
  'Bookmarks':                    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80',
  'Greeting Cards':               'https://images.unsplash.com/photo-1521898284481-a5ec348cb555?w=600&q=80',
  'Specialty Greeting Cards':     'https://images.unsplash.com/photo-1521898284481-a5ec348cb555?w=600&q=80',
  'Invitations':                  'https://images.unsplash.com/photo-1521898284481-a5ec348cb555?w=600&q=80',
  'Envelopes':                    'https://images.unsplash.com/photo-1580901368919-7738efb0f87e?w=600&q=80',
  'Letterhead':                   'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  'Notepads':                     'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&q=80',
  'Presentation Folders':         'https://images.unsplash.com/photo-1568234928966-359c35dd8327?w=600&q=80',
  'Stickers':                     'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Roll Labels / Stickers':       'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Square Cut Labels / Stickers': 'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Adhesive Vinyl':               'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Wall Decals':                  'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Window Graphics':              'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Floor Graphics':               'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Clings':                       'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Covid-19-Decals':              'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Covid-19-Decals-':             'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
  'Signs':                        'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Aluminum Signs':               'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Coroplast Signs & Yard Signs': 'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Coroplast Signs & Yard Signs-':'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Styrene Signs':                'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Foam Board':                   'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Sintra/Rigid Board':           'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Display Board / POP':          'https://images.unsplash.com/photo-1528818955841-a7f1425131b5?w=600&q=80',
  'Magnets':                      'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80',
  'Car Magnets':                  'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80',
  'Canvas':                       'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=600&q=80',
  'Digital Sheets':               'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  'Plastics':                     'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  'Table Covers':                 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'Tent Cards':                   'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&q=80',
  'Tear Cards':                   'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&q=80',
  'Door Hangers':                 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
  'NCR Forms':                    'https://images.unsplash.com/photo-1568234928966-359c35dd8327?w=600&q=80',
  'Numbered Tickets':             'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80',
  'Wall Calendars':               'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&q=80',
  'A Frame Stands':               'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'A-Frame Signs':                'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'H Stands for Signs':           'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
  'Supply Boxes':                 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&q=80',
  'Sample Kits':                  'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&q=80',
  'Unaddressed Admail':           'https://images.unsplash.com/photo-1580901368919-7738efb0f87e?w=600&q=80',
  'Variable Printing':            'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  'White Vinyl':                  'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?w=600&q=80',
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=600&q=80'

function getImageForCategory(category) {
  return CATEGORY_IMAGES[category] || DEFAULT_IMAGE
}

// ── SinaLite helpers ─────────────────────────────────────────────────────────
async function getSinaLiteToken() {
  const res = await fetch(`${SINALITE_AUTH_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: SINALITE_CLIENT_ID,
      client_secret: SINALITE_CLIENT_SECRET,
      audience: SINALITE_AUDIENCE,
    }),
  })
  if (!res.ok) throw new Error(`SinaLite auth failed: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return data.access_token
}

async function getSinaLiteProducts(token) {
  const res = await fetch(`${SINALITE_API_URL}/product`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch SinaLite products: ${res.status}`)
  return res.json()
}

/** Fetches and groups options for a single SinaLite product. Returns [] on any failure. */
async function getSinaLiteProductOptions(token, productId) {
  try {
    const res = await fetch(`${SINALITE_API_URL}/product/${productId}/option`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    const flat = Array.isArray(data[0]) ? data[0] : (Array.isArray(data) ? data : [])
    const grouped = {}
    const idMap = {}
    for (const opt of flat) {
      if (!opt.group || opt.hidden) continue
      if (!grouped[opt.group]) { grouped[opt.group] = []; idMap[opt.group] = {} }
      if (!grouped[opt.group].includes(opt.name)) {
        grouped[opt.group].push(opt.name)
        idMap[opt.group][opt.name] = opt.id
      }
    }
    return Object.entries(grouped).map(([name, values]) => ({ name, values, optionIds: idMap[name] || {} }))
  } catch {
    return []
  }
}

// ── Popular blueprint IDs to include from Printify catalog ──────────────────
// These are well-known popular apparel/accessory items (each gets its blueprint image from API)
const POPULAR_BLUEPRINT_IDS = [
  5,    // Next Level - Unisex Cotton Crew Tee (short sleeve)
  6,    // Gildan - Unisex Heavy Cotton Tee
  9,    // Bella+Canvas - Women's Favorite Tee
  12,   // Bella+Canvas - Unisex Jersey Short Sleeve Tee
  45,   // Next Level - Men's Long Sleeve Crew Tee
  77,   // Gildan - Unisex Heavy Blend Crewneck Sweatshirt
  92,   // Bella+Canvas - Unisex Sponge Fleece Full-Zip Hoodie
  429,  // Bella+Canvas - Unisex Fleece Pullover Hoodie
  146,  // Gildan - Youth Heavy Cotton Tee
  200,  // Mug 11oz
  202,  // Mug 15oz
  471,  // Tote Bag
  368,  // Unisex Baseball Cap
  357,  // Embroidered Unisex Dad Hat
  487,  // Poster (various sizes)
  515,  // Canvas Print
]

// ── Printify helpers ─────────────────────────────────────────────────────────
async function getPrintifyCatalogBlueprints(apiKey) {
  const res = await fetch('https://api.printify.com/v1/catalog/blueprints.json', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Printify catalog failed: ${res.status}`)
  return res.json()
}

async function getPrintifyShops(apiKey) {
  const res = await fetch('https://api.printify.com/v1/shops.json', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Printify shops failed: ${res.status}`)
  return res.json()
}

async function getPrintifyShopProducts(apiKey, shopId) {
  const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products.json?page=1&per_page=100`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Printify products failed: ${res.status}`)
  return res.json()
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting product sync...')

  // ── 1. SinaLite ─────────────────────────────────────────────────────────
  console.log('\n📦 Syncing SinaLite products...')
  let sinaliteProducts = []
  try {
    const token = await getSinaLiteToken()
    console.log('✅ SinaLite token obtained')

    const rawProducts = await getSinaLiteProducts(token)
    console.log(`📋 Found ${rawProducts.length} SinaLite products`)

    const activeProducts = rawProducts.filter(p => p.enabled === 1)
    console.log(`✅ ${activeProducts.length} active products`)

    console.log('  Fetching options for each product (this takes ~30s)...')
    for (let i = 0; i < activeProducts.length; i++) {
      const p = activeProducts[i]
      process.stdout.write(`\r  [${i + 1}/${activeProducts.length}] ${p.name.slice(0, 55).padEnd(55)}`)

      // Fetch options and store them so production doesn't need a live API call
      const options = await getSinaLiteProductOptions(token, p.id)

      // Small delay to avoid rate-limiting (200 ms per product)
      await new Promise(resolve => setTimeout(resolve, 200))

      sinaliteProducts.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        image: getImageForCategory(p.category),
        description: `Professional ${p.name} printing. High-quality results with fast turnaround.`,
        options,
        optionIds: options.reduce((acc, g) => {
          acc[g.name] = g.optionIds || {}
          return acc
        }, {}),
        source: 'sinalite',
      })
    }
    console.log('\n✅ SinaLite products + options processed')
  } catch (err) {
    console.error('\n❌ SinaLite error:', err.message)
  }

  // ── 2. Printify ──────────────────────────────────────────────────────────
  let printifyProducts = []
  if (PRINTIFY_API_KEY) {
    console.log('\n👕 Syncing Printify products...')
    try {
      // First try shop products (if the merchant has created any)
      const shops = await getPrintifyShops(PRINTIFY_API_KEY)
      console.log(`✅ Found ${shops.length} Printify shop(s)`)

      let shopProductsAdded = 0
      for (const shop of shops) {
        console.log(`  Shop: ${shop.title} (${shop.id})`)
        const { data: products } = await getPrintifyShopProducts(PRINTIFY_API_KEY, shop.id)
        console.log(`  Found ${products.length} published products`)

        for (const p of products) {
          const firstImage = p.images?.[0]?.src || DEFAULT_IMAGE
          printifyProducts.push({
            id: `printify_${p.id}`,
            sku: p.id,
            name: p.title,
            category: 'Apparel',
            image: firstImage,
            description: p.description || '',
            source: 'printify',
            shopId: String(shop.id),
          })
          shopProductsAdded++
        }
      }

      // If shop is empty, fall back to Printify catalog blueprints
      if (shopProductsAdded === 0) {
        console.log('  Shop is empty — loading popular products from Printify catalog...')
        const allBlueprints = await getPrintifyCatalogBlueprints(PRINTIFY_API_KEY)
        
        // Map category based on title keywords
        const getCategory = (title) => {
          const t = title.toLowerCase()
          if (t.includes('hoodie') || t.includes('sweatshirt')) return 'Hoodies & Sweatshirts'
          if (t.includes('tee') || t.includes('t-shirt') || t.includes('shirt')) return 'T-Shirts'
          if (t.includes('mug') || t.includes('cup')) return 'Mugs & Drinkware'
          if (t.includes('hat') || t.includes('cap') || t.includes('beanie')) return 'Hats & Headwear'
          if (t.includes('bag') || t.includes('tote') || t.includes('backpack')) return 'Bags & Accessories'
          if (t.includes('poster') || t.includes('print') || t.includes('canvas')) return 'Prints & Wall Art'
          if (t.includes('phone') || t.includes('case')) return 'Phone Cases'
          return 'Apparel'
        }

        // Take popular items from catalog
        const popularBlueprints = allBlueprints.filter(b => 
          POPULAR_BLUEPRINT_IDS.includes(b.id)
        )

        // Also add top t-shirts, hoodies, mugs not in popular list (up to 30 total)
        const extraItems = allBlueprints
          .filter(b => !POPULAR_BLUEPRINT_IDS.includes(b.id))
          .filter(b => {
            const t = b.title.toLowerCase()
            return t.includes('tee') || t.includes('hoodie') || t.includes('mug') || 
                   t.includes('hat') || t.includes('sweatshirt') || t.includes('tote')
          })
          .slice(0, 20)

        const combined = [...popularBlueprints, ...extraItems].slice(0, 50)
        console.log(`  Using ${combined.length} Printify catalog products`)

        for (const b of combined) {
          const imageUrl = b.images?.[0]
            ? `https://images.printify.com/${b.images[0]}`.replace('https://images.printify.com/https://images.printify.com/', 'https://images.printify.com/')
            : DEFAULT_IMAGE
          
          printifyProducts.push({
            id: `printify_bp_${b.id}`,
            sku: `blueprint_${b.id}`,
            name: `${b.title} — ${b.brand}`,
            category: getCategory(b.title),
            image: b.images?.[0]?.startsWith('http') ? b.images[0] : `https://images.printify.com/${b.images[0]}`,
            description: `Custom printed ${b.title} by ${b.brand}. Upload your design and we'll print and ship it for you.`,
            source: 'printify',
            blueprintId: b.id,
            brand: b.brand,
          })
        }
      }

      console.log(`✅ Printify: ${printifyProducts.length} products`)
    } catch (err) {
      console.error('❌ Printify error:', err.message)
    }
  } else {
    console.log('\n⚠️  Printify API key not set (set PRINTIFY_API_KEY env var). Skipping Printify sync.')
  }

  // ── 3. Combine and save ──────────────────────────────────────────────────
  const allProducts = [...sinaliteProducts, ...printifyProducts]
  const output = {
    synced_at: new Date().toISOString(),
    count: allProducts.length,
    sinalite_count: sinaliteProducts.length,
    printify_count: printifyProducts.length,
    products: allProducts,
  }

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true })
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))
  
  console.log(`\n🎉 Done! Saved ${allProducts.length} products to src/data/sinaliteProducts.json`)
  console.log(`   📦 SinaLite: ${sinaliteProducts.length} products`)
  console.log(`   👕 Printify: ${printifyProducts.length} products`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
