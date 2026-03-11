/**
 * add-base-prices.mjs
 * Adds basePriceCents to products in sinaliteProducts.json.
 * Run after sync. Uses category-based defaults when product has no price.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const jsonPath = join(__dir, '../src/data/sinaliteProducts.json')

const CATEGORY_DEFAULTS = {
  'Business Cards': 2499,
  'Folded Business Cards': 4999,
  'Specialty Business Cards': 3999,
  'Postcards': 1999,
  'Postcard Addressed': 2999,
  'Specialty Post Cards': 2999,
  'Flyers': 1499,
  'Brochures': 3999,
  'Booklets': 5999,
  'Posters': 1999,
  'Large Format Posters': 4999,
  'Presentation Folders': 2999,
  'Door Hangers': 1499,
  'Greeting Cards': 1999,
  'Magnets': 1499,
  'Mugs & Drinkware': 1499,
  'T-Shirts': 2499,
  'Hoodies & Sweatshirts': 4499,
  'Apparel': 2499,
  'Hats & Headwear': 2499,
  'Bags & Accessories': 1999,
  'Prints & Wall Art': 2999,
}
const DEFAULT_PRICE = 2999

const data = JSON.parse(readFileSync(jsonPath, 'utf8'))
let updated = 0
data.products = data.products.map((p) => {
  if (p.basePriceCents || p.priceCents) return p
  const cents = CATEGORY_DEFAULTS[p.category] || DEFAULT_PRICE
  updated++
  return { ...p, basePriceCents: cents }
})
writeFileSync(jsonPath, JSON.stringify(data, null, 2))
console.log(`Added basePriceCents to ${updated} products`)
