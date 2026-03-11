/**
 * scrape-sinalite-images.mjs
 * Downloads real product images from sinalite.com into public/images/categories/
 * and updates sinaliteProducts.json to use local paths.
 */
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT  = path.resolve(__dir, '..')
const OUT   = path.join(ROOT, 'public', 'images', 'categories')
fs.mkdirSync(OUT, { recursive: true })

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fetch(url, depth = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && depth < 5) {
        res.resume()
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : 'https://sinalite.com' + res.headers.location
        return resolve(fetch(next, depth + 1))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), type: res.headers['content-type'] || '' }))
    })
    req.on('error', reject)
  })
}

// ── Download & save image ─────────────────────────────────────────────────────
async function downloadImage(url, filename) {
  const res = await fetch(url)
  if (res.status !== 200) return null
  // Skip if it's the Magento placeholder (1692 bytes)
  if (res.body.length < 2000) return null
  const outPath = path.join(OUT, filename)
  fs.writeFileSync(outPath, res.body)
  return `/images/categories/${filename}`
}

// ── Scrape category page for product thumbnails ───────────────────────────────
async function scrapeCategoryImages(categoryPath) {
  const url = `https://sinalite.com/en_ca/${categoryPath}`
  const res = await fetch(url)
  if (res.status !== 200) return []
  const html = res.body.toString('utf8')
  // Find all img src or data-src attributes pointing to sinalite
  const imgPattern = /(?:src|data-src)=['"](https?:\/\/[^'"]+sinalite[^'"]+\.(?:jpg|jpeg|png|webp))['"]/gi
  const found = []
  let m
  while ((m = imgPattern.exec(html)) !== null) {
    const u = m[1]
    if (!u.includes('placeholder') && !u.includes('free-delivery') && !u.includes('ca-flag') && !u.includes('flag-icn') && !u.includes('popup') && !u.includes('banner')) {
      found.push(u)
    }
  }
  return [...new Set(found)]
}

// ── Category → sinalite.com page slug mapping ────────────────────────────────
const CATEGORY_PAGES = {
  'Business Cards':               'business-cards.html',
  'Specialty Business Cards':     'specialty-business-cards.html',
  'Folded Business Cards':        'folded-business-cards.html',
  'Postcards':                    'postcards.html',
  'Flyers':                       'flyers.html',
  'Brochures':                    'brochures.html',
  'Booklets':                     'booklets.html',
  'Presentation Folders':         'presentation-folders.html',
  'Door Hangers':                 'door-hangers.html',
  'Greeting Cards':               'greeting-cards.html',
  'Envelopes':                    'envelopes.html',
  'Letterhead':                   'letterhead.html',
  'Notepads':                     'notepads.html',
  'Posters':                      'posters.html',
  'Large Format Posters':         'large-format-posters.html',
  'Vinyl Banners':                'vinyl-banners.html',
  'Pull Up Banners':              'pull-up-banners.html',
  'Roll Labels / Stickers':       'roll-labels-stickers.html',
  'Magnets':                      'magnets.html',
  'Car Magnets':                  'car-magnets.html',
  'Wall Calendars':               'wall-calendars.html',
  'Canvas':                       'canvas-prints.html',
  'Foam Board':                   'foam-board.html',
  'T-Shirts':                     'apparel/t-shirts.html',
  'Apparel':                      'apparel.html',
}

// ── High-quality fallback images per category (Unsplash - verified working) ──
const FALLBACKS = {
  'Business Cards':               'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&q=80',
  'Specialty Business Cards':     'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80',
  'Folded Business Cards':        'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80',
  'Postcards':                    'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&q=80',
  'Specialty Post Cards':         'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&q=80',
  'Flyers':                       'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80',
  'Brochures':                    'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&q=80',
  'Booklets':                     'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
  'Bookmarks':                    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
  'Presentation Folders':         'https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80',
  'Door Hangers':                 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Greeting Cards':               'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&q=80',
  'Specialty Greeting Cards':     'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&q=80',
  'Invitations':                  'https://images.unsplash.com/photo-1608755728617-aefab37d2edd?w=400&q=80',
  'Envelopes':                    'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&q=80',
  'Letterhead':                   'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=400&q=80',
  'Notepads':                     'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&q=80',
  'NCR Forms':                    'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&q=80',
  'Tear Cards':                   'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&q=80',
  'Tent Cards':                   'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&q=80',
  'Posters':                      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Large Format Posters':         'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Vinyl Banners':                'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80',
  'Banners':                      'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80',
  'X-Frame Banners':              'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80',
  'Pull Up Banners':              'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80',
  'Pull Up Banners-':             'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80',
  'Roll Labels / Stickers':       'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Square Cut Labels / Stickers': 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Stickers':                     'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Magnets':                      'https://images.unsplash.com/photo-1527004013197-933b2fbc71cf?w=400&q=80',
  'Car Magnets':                  'https://images.unsplash.com/photo-1527004013197-933b2fbc71cf?w=400&q=80',
  'Clings':                       'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Adhesive Vinyl':               'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Window Graphics':              'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Wall Decals':                  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Floor Graphics':               'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Canvas':                       'https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?w=400&q=80',
  'Foam Board':                   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Display Board / POP':          'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&q=80',
  'Coroplast Signs & Yard Signs': 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=400&q=80',
  'Coroplast Signs & Yard Signs-':'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=400&q=80',
  'A Frame Stands':               'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80',
  'A-Frame Signs':                'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80',
  'H Stands for Signs':           'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80',
  'Aluminum Signs':               'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80',
  'Styrene Signs':                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Sintra/Rigid Board':           'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Plastics':                     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Digital Sheets':               'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80',
  'Supply Boxes':                 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=80',
  'Wall Calendars':               'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400&q=80',
  'T-Shirts':                     'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
  'Apparel':                      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&q=80',
  'Hoodies & Sweatshirts':        'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&q=80',
  'Mugs & Drinkware':             'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80',
  'Table Covers':                 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&q=80',
  'Covid-19-Decals-':             'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
}

async function main() {
  const jsonPath = path.join(ROOT, 'src', 'data', 'sinaliteProducts.json')
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  // Build category → image map
  const catImageMap = {}

  console.log('🔍  Checking sinalite.com for real product images...\n')
  for (const [cat, page] of Object.entries(CATEGORY_PAGES)) {
    process.stdout.write(`  ${cat}: `)
    const images = await scrapeCategoryImages(page)
    if (images.length > 0) {
      // Try to download first non-placeholder image
      const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const filename = `${slug}.jpg`
      let localPath = null
      for (const imgUrl of images.slice(0, 3)) {
        localPath = await downloadImage(imgUrl, filename)
        if (localPath) break
      }
      if (localPath) {
        catImageMap[cat] = localPath
        console.log(`✅  saved ${filename} (${images.length} found)`)
      } else {
        catImageMap[cat] = FALLBACKS[cat] || null
        console.log(`⚠️   images too small/placeholder, using fallback`)
      }
    } else {
      catImageMap[cat] = FALLBACKS[cat] || null
      console.log(`⚠️   no images found, using fallback`)
    }
    await new Promise(r => setTimeout(r, 200)) // polite delay
  }

  // Apply fallbacks for categories not in CATEGORY_PAGES
  for (const cat of [...new Set(data.products.map(p => p.category))]) {
    if (!catImageMap[cat] && FALLBACKS[cat]) catImageMap[cat] = FALLBACKS[cat]
  }

  // Update only SinaLite products — never overwrite Printify (they use Printify API images)
  let updated = 0
  data.products = data.products.map(p => {
    if (p.source === 'printify') return p
    const img = catImageMap[p.category] || FALLBACKS[p.category] || null
    if (img !== p.image) updated++
    return { ...p, image: img }
  })

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2))
  console.log(`\n✅  Updated ${updated} product images`)
  console.log('   Local images saved to: public/images/categories/')
}

main().catch(console.error)
