/**
 * map-product-images.mjs
 * Assigns unique per-product images from real sinalite.com downloads
 * and high-quality Unsplash fallbacks for categories without scraped images.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dir, '..')
const jsonPath = path.join(ROOT, 'src', 'data', 'sinaliteProducts.json')

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

// ── Per-SKU exact image mapping (real sinalite.com images downloaded locally) ──
const SKU_MAP = {
  // Business Cards
  'businesscard_14pt_profit_maximizer':     '/images/products/bc-profit-maximizer.png',
  'businesscard_14pt_aq':                   '/images/products/bc-aq.png',
  'businesscard_14pt_uv_high_gloss':        '/images/products/bc-uv-gloss.png',
  'businesscard_14pt_matte_satin_aq':       '/images/products/bc-matte.png',
  'businesscard_16pt_matte_silk_lamination':'/images/products/bc-laminated.png',
  'businesscard_16pt_gloss_lamination':     '/images/products/bc-laminated.png',
  'businesscard_14pt_writable _aq_c1s':     '/images/products/bc-aq.png',
  'businesscard_14pt_writable_uv_c1s':      '/images/products/bc-uv-gloss.png',
  'businesscard_13pt_enviro_uncoated':      '/images/products/bc-enviro.png',
  'businesscard_16pt_aq':                   '/images/products/bc-aq.png',
  'businesscard_16pt_uv':                   '/images/products/bc-uv-gloss.png',
  'businesscard_16pt_matte_satin_aq':       '/images/products/bc-matte.png',
  'businesscard_13pt_linen_uncoated':       '/images/products/bc-enviro.png',
  'businesscards18ptc1s':                   '/images/products/bc-laminated.png',
  // Specialty Business Cards
  'businesscard_16pt_matte_lam_spot_uv':    '/images/products/bc-spot-uv.png',
  'foil-gold-silver':                       'https://images.unsplash.com/photo-1614850715649-1d0106293bd1?w=400&q=80',
  'durable-business-cards':                 'https://images.unsplash.com/photo-1603202662706-62ede22e6e87?w=400&q=80',
  'kraft-business-cards':                   'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80',
  'pearl-business-cards':                   'https://images.unsplash.com/photo-1572521165329-b197f9ea3da6?w=400&q=80',
  'die_cut_business_cards':                 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80',
  'soft_touch_business_cards':              'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&q=80',
  'ultra-smooth-business-cards':            'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&q=80',
  // Folded Business Cards
  'foldedbusinesscards_14pt_uv':            '/images/products/folded-bc-uv.jpg',
  'foldedbusinesscards_14pt_matteaq':       '/images/products/folded-bc-matte.jpg',
  'foldedbusinesscards_13pt_enviro':        '/images/products/folded-bc-enviro.jpg',
  // Postcards
  'postcards14pt_aq':                       '/images/products/postcard-aq.png',
  'postcards14pt_uv':                       '/images/products/postcard-uv.png',
  'postcards_14pt_matteaq':                 '/images/products/postcard-matte.png',
  'postcards_16pt_mattelam':                '/images/products/postcard-gloss-lam.png',
  'postcards_16pt_glosslam':                '/images/products/postcard-gloss-lam.png',
  'postcards_10pt_aq':                      '/images/products/postcard-sameday.png',
  'postcards_14ptc1s_aq':                   '/images/products/postcard-aq.png',
  'postcards_14ptc1s_uv':                   '/images/products/postcard-uv.png',
  'postcards_13pt_enviro':                  '/images/products/postcard-enviro.png',
  'postcards_16pt_aq':                      '/images/products/postcard-aq.png',
  'postcards_16pt_uv':                      '/images/products/postcard-uv.png',
  'postcards_16pt_matteaq':                 '/images/products/postcard-matte.png',
  'postcards_13pt_linen':                   '/images/products/postcard-enviro.png',
  'postcard_16PT_matte_lam_spot_uv':        '/images/products/postcard-matte-lam.png',
  'postcards_10pt_matte_finish':            '/images/products/postcard-matte.png',
  // Flyers
  'flyers_100lb_gloss':                     '/images/products/flyer-gloss.jpg',
  'flyers_100lb_uv':                        '/images/products/flyer-uv.jpg',
  'flyers_100lb_matteaq':                   '/images/products/flyer-matte.jpg',
  'flyers_80lb_enviro':                     '/images/products/flyer-enviro.jpg',
  'flyers_70lb_linen':                      '/images/products/flyer-linen.jpg',
  // Brochures
  'brochures_100lb_gloss':                  '/images/products/brochure-gloss.jpg',
  'brochures_100lb_uv':                     '/images/products/brochure-uv.jpg',
  'brochures_100lb_matteaq':                '/images/products/brochure-matte.jpg',
  'brochures_80lb_enviro':                  '/images/products/brochure-enviro.jpg',
  // Booklets
  'booklets_80lb_85x55':                    '/images/products/booklet-half.jpg',
  'booklets_80lb_85x11':                    '/images/products/booklet-letter.jpg',
  'booklets_100lb_85x55':                   '/images/products/booklet-half.jpg',
  'booklets_100lb_85x11':                   '/images/products/booklet-letter.jpg',
  'booklets_offset_60lb_85x11':             '/images/products/booklet-letter.jpg',
  'booklets_offset_60lb_85x55':             '/images/products/booklet-half.jpg',
  'booklets_80lb_silk_text_85x55':          '/images/products/booklet-half.jpg',
  'booklets_80lb_silk_text_85x11':          '/images/products/booklet-letter.jpg',
  'booklets_100lb_silk_text_85x55':         '/images/products/booklet-half.jpg',
  'booklets_100lb_silk_text_85x11':         '/images/products/booklet-letter.jpg',
  // Presentation Folders
  'presentationfolders_14pt_aq':            '/images/products/folder-aq.png',
  'presentationfolders_14pt_matteaq':       '/images/products/folder-matte.png',
  'presentationfolders_14pt_uv':            '/images/products/folder-uv.png',
  'presentation_folders_14pt_matte_lam':    '/images/products/folder-matte.png',
  // Door Hangers
  'doorhangers_14pt_aq':                    '/images/products/door-hanger-aq.jpg',
  'doorhangers_14pt_uv':                    '/images/products/door-hanger-uv.jpg',
  'doorhangers_14pt_matteaq':               '/images/products/door-hanger-matte.jpg',
  'doorhangers_13pt_enviro':                '/images/products/door-hanger-enviro.jpg',
  // Greeting Cards
  'greetingcards_14pt_aq':                  '/images/products/greeting-aq.jpg',
  'greetingcards_14pt_uv':                  '/images/products/greeting-uv.jpg',
  'greetingcards_14pt_matteaq':             '/images/products/greeting-matte.jpg',
  'greetingcards_14c1s_aq':                 '/images/products/greeting-aq.jpg',
  'greetingcards_14ptc1s_uv':               '/images/products/greeting-uv.jpg',
  'greetingcards_13pt_enviro':              '/images/products/greeting-enviro.jpg',
  // Posters
  'posters_100lb':                          '/images/products/poster-gloss.jpg',
  'posters_100lb_matteaq':                  '/images/products/poster-matte.jpg',
  'posters_100lb_uv':                       '/images/products/poster-uv.jpg',
  'posters_80lb_enviro':                    '/images/products/poster-enviro.jpg',
  // Magnets
  'magnets_14pt':                           '/images/products/magnet-standard.jpg',
  'cut-to-shape-magnets-30mil':             '/images/products/magnet-die-cut.png',
  'cut-to-shape-magnets-20mil':             '/images/products/magnet-die-cut.png',
  // Calendars
  'calendars_80lb':                         '/images/products/calendar.jpg',
  'calendars_100lb':                        '/images/products/calendar.jpg',
  // Envelopes
  'envelopes_60lb':                         'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&q=80',
  'security_envelopes':                     'https://images.unsplash.com/photo-1586282391129-76a6df230234?w=400&q=80',
  'envelopes_60lb_self_adhesive':           'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&q=80',
  // Letterhead
  'letterheads_60lb':                       'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=400&q=80',
  // Notepads
  'notepads_60lb_25pg':                     'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&q=80',
  'notepads_60lb_50pg':                     'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&q=80',
  // Plastics
  'plastic_14pt':                           'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&q=80',
  // Clings
  'clings_transparent':                     'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'clings_opaque':                          'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=400&q=80',
}

// ── Category-level fallbacks ────────────────────────────────────────────────
const CAT_MAP = {
  'Business Cards':               '/images/products/bc-aq.png',
  'Specialty Business Cards':     '/images/products/bc-spot-uv.png',
  'Folded Business Cards':        '/images/products/folded-bc-uv.jpg',
  'Postcards':                    '/images/products/postcard-aq.png',
  'Specialty Post Cards':         '/images/products/postcard-matte-lam.png',
  'Flyers':                       '/images/products/flyer-gloss.jpg',
  'Brochures':                    '/images/products/brochure-gloss.jpg',
  'Booklets':                     '/images/products/booklet-letter.jpg',
  'Bookmarks':                    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
  'Presentation Folders':         '/images/products/folder-aq.png',
  'Door Hangers':                 '/images/products/door-hanger-aq.jpg',
  'Greeting Cards':               '/images/products/greeting-aq.jpg',
  'Specialty Greeting Cards':     '/images/products/greeting-metallic.png',
  'Invitations':                  'https://images.unsplash.com/photo-1608755728617-aefab37d2edd?w=400&q=80',
  'Envelopes':                    'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&q=80',
  'Letterhead':                   'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=400&q=80',
  'Notepads':                     'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&q=80',
  'NCR Forms':                    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80',
  'Tear Cards':                   '/images/products/postcard-matte.png',
  'Tent Cards':                   'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&q=80',
  'Posters':                      '/images/products/poster-gloss.jpg',
  'Large Format Posters':         '/images/products/poster-large-format.jpg',
  'Vinyl Banners':                'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80',
  'Banners':                      'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80',
  'X-Frame Banners':              'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80',
  'Pull Up Banners':              'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80',
  'Pull Up Banners-':             'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80',
  'Roll Labels / Stickers':       'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Square Cut Labels / Stickers': 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=400&q=80',
  'Stickers':                     'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&q=80',
  'Magnets':                      '/images/products/magnet-standard.jpg',
  'Car Magnets':                  '/images/products/magnet-die-cut.png',
  'Clings':                       'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  'Adhesive Vinyl':               'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Window Graphics':              'https://images.unsplash.com/photo-1583416750470-965b2707b355?w=400&q=80',
  'Wall Decals':                  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Floor Graphics':               'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Canvas':                       'https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?w=400&q=80',
  'Foam Board':                   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Display Board / POP':          'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&q=80',
  'Coroplast Signs & Yard Signs': 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=400&q=80',
  'Coroplast Signs & Yard Signs-':'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=400&q=80',
  'A Frame Stands':               'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80',
  'A-Frame Signs':                'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80',
  'H Stands for Signs':           'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80',
  'Aluminum Signs':               'https://images.unsplash.com/photo-1567168544813-cc03465b4fa8?w=400&q=80',
  'Styrene Signs':                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Sintra/Rigid Board':           'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Plastics':                     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'Digital Sheets':               'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80',
  'Supply Boxes':                 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=80',
  'Wall Calendars':               '/images/products/calendar.jpg',
  'T-Shirts':                     'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
  'Apparel':                      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&q=80',
  'Hoodies & Sweatshirts':        'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&q=80',
  'Mugs & Drinkware':             'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80',
  'Table Covers':                 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&q=80',
  'Covid-19-Decals-':             'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
}

let updated = 0, skuMapped = 0, catMapped = 0, noImage = 0

data.products = data.products.map(p => {
  const trimSku = (p.sku || '').trim()
  let img = SKU_MAP[trimSku]
  if (img) {
    skuMapped++
  } else {
    img = CAT_MAP[p.category]
    if (img) catMapped++
    else noImage++
  }
  if (img && img !== p.image) updated++
  return { ...p, image: img || p.image }
})

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2))

console.log(`Updated: ${updated} products`)
console.log(`  SKU-matched: ${skuMapped} | Category-matched: ${catMapped} | No image: ${noImage}`)

// Verify: show image diversity
const byImg = {}
data.products.forEach(p => { byImg[p.image] = (byImg[p.image] || 0) + 1 })
const sorted = Object.entries(byImg).sort((a, b) => b[1] - a[1])
console.log(`\nUnique images: ${sorted.length} / Total sinalite products: ${data.products.filter(p=>p.source==='sinalite').length}`)
console.log('\nTop 15 most used images:')
sorted.slice(0, 15).forEach(([img, cnt]) => console.log(`  x${cnt}  ${(img||'null').substring(0, 80)}`))

// Show a few examples per category
const cats = ['Business Cards','Postcards','Flyers','Door Hangers','Greeting Cards']
cats.forEach(cat => {
  const prods = data.products.filter(p => p.category === cat)
  console.log(`\n${cat} (${prods.length}):`)
  prods.forEach(p => console.log(`  ${p.sku?.trim()?.substring(0,35).padEnd(35)} → ${p.image?.substring(0,70)}`))
})
