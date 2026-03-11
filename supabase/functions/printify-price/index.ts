import { serve } from 'https://deno.land/std@0.168.0/http_server.ts'

const PRINTIFY_API_KEY = Deno.env.get('PRINTIFY_API_KEY') || Deno.env.get('VITE_PRINTIFY_API_KEY') || ''
const DEFAULT_MARKUP = 2.0 // cost * markup = retail price (cents)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { blueprintId } = await req.json()
    if (!blueprintId) {
      return new Response(JSON.stringify({ error: 'blueprintId required' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    if (!PRINTIFY_API_KEY) {
      return new Response(JSON.stringify({ error: 'Printify API not configured', priceCents: null }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const bpRes = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}.json`, {
      headers: { Authorization: `Bearer ${PRINTIFY_API_KEY}` },
    })
    if (!bpRes.ok) {
      throw new Error(`Printify blueprint: ${bpRes.status}`)
    }

    const ppRes = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers.json`, {
      headers: { Authorization: `Bearer ${PRINTIFY_API_KEY}` },
    })
    if (!ppRes.ok) {
      throw new Error(`Printify print providers: ${ppRes.status}`)
    }
    const providers: { id: number }[] = await ppRes.json()
    const firstProviderId = providers?.[0]?.id
    if (firstProviderId == null) {
      return new Response(JSON.stringify({ priceCents: null, error: 'No print provider' }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const varRes = await fetch(
      `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${firstProviderId}/variants.json`,
      { headers: { Authorization: `Bearer ${PRINTIFY_API_KEY}` } }
    )
    if (!varRes.ok) {
      throw new Error(`Printify variants: ${varRes.status}`)
    }
    const varData = await varRes.json()
    const variants = varData?.variants ?? []
    let minCostCents: number | null = null
    for (const v of variants) {
      const cost = v.cost != null ? Number(v.cost) : null
      if (cost != null && (minCostCents == null || cost < minCostCents)) minCostCents = cost
    }
    if (minCostCents == null) {
      return new Response(JSON.stringify({ priceCents: null }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }
    const priceCents = Math.round(minCostCents * DEFAULT_MARKUP)
    return new Response(JSON.stringify({ priceCents }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    console.error('Printify price error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Failed to get price', priceCents: null }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
