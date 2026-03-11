/**
 * refresh-printify-images.mjs
 * Fetches correct product images from Printify API for each Printify product in sinaliteProducts.json.
 * Run after sync to ensure each product (e.g. Men's Long Sleeve vs Short Sleeve) shows its correct mockup.
 *
 * Usage: PRINTIFY_API_KEY=xxx node scripts/refresh-printify-images.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const jsonPath = join(__dir, '../src/data/sinaliteProducts.json')

function loadEnv() {
  try {
    const envPath = join(__dir, '../.env')
    const content = readFileSync(envPath, 'utf8')
    const vars = {}
    for (const line of content.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      vars[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    return vars
  } catch {
    return {}
  }
}

const env = loadEnv()
const API_KEY = process.env.PRINTIFY_API_KEY || env.PRINTIFY_API_KEY || env.VITE_PRINTIFY_API_KEY || ''

async function getBlueprint(blueprintId) {
  const res = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}.json`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) return null
  return res.json()
}

async function main() {
  if (!API_KEY) {
    console.log('⚠️  Set PRINTIFY_API_KEY in .env. Skipping.')
    process.exit(0)
  }

  const data = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const printifyProducts = data.products.filter((p) => p.source === 'printify' && p.blueprintId)
  if (printifyProducts.length === 0) {
    console.log('No Printify products with blueprintId found.')
    return
  }

  console.log(`Refreshing images for ${printifyProducts.length} Printify products...`)
  const blueprintCache = {}
  let updated = 0

  for (const p of printifyProducts) {
    const bid = p.blueprintId
    if (!blueprintCache[bid]) {
      const bp = await getBlueprint(bid)
      blueprintCache[bid] = bp
      await new Promise((r) => setTimeout(r, 150)) // rate limit
    }
    const bp = blueprintCache[bid]
    if (!bp?.images?.length) continue
    const img = bp.images[0]
    const url = typeof img === 'string'
      ? img.startsWith('http') ? img : `https://images.printify.com/${img.replace(/^\/+/, '')}`
      : null
    if (url && p.image !== url) {
      p.image = url
      updated++
      console.log(`  ${p.name?.slice(0, 50)} → ${url.slice(0, 60)}...`)
    }
  }

  writeFileSync(jsonPath, JSON.stringify(data, null, 2))
  console.log(`\n✅ Updated ${updated} Printify product images`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
