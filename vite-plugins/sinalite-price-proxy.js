/**
 * Local dev proxy for SinaLite price API.
 * Bypasses Supabase edge function when running npm run dev.
 */
const SINALITE_CLIENT_ID = process.env.VITE_SINALITE_CLIENT_ID || 'jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H'
const SINALITE_CLIENT_SECRET = process.env.VITE_SINALITE_CLIENT_SECRET || 'nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b'
const SINALITE_AUDIENCE = process.env.VITE_SINALITE_AUDIENCE || 'https://apiconnect.sinalite.com'
const SINALITE_AUTH_URL = process.env.VITE_SINALITE_AUTH_URL || 'https://api.sinaliteuppy.com'
const SINALITE_API_URL = process.env.VITE_SINALITE_API_URL || 'https://api.sinaliteuppy.com'

let cachedToken = null

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token
  }
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
  if (!res.ok) throw new Error(`SinaLite auth failed: ${res.statusText}`)
  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  }
  return cachedToken.token
}

export function sinalitePriceProxy() {
  return {
    name: 'sinalite-price-proxy',
    configureServer(server) {
      server.middlewares.use('/api/sinalite-price', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const { action, productId, productOptions, qty, storeCode = 'en_ca' } = JSON.parse(body || '{}')
            if (!productId) {
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Product ID required' }))
              return
            }
            const token = await getToken()
            if (action === 'calculatePrice' && productOptions && Array.isArray(productOptions)) {
              const priceRes = await fetch(`${SINALITE_API_URL}/price/${productId}/${storeCode}`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ productOptions, ...(qty && { qty }) }),
              })
              if (!priceRes.ok) {
                const err = await priceRes.text()
                throw new Error(`SinaLite API: ${err}`)
              }
              const data = await priceRes.json()
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.statusCode = 200
              res.end(JSON.stringify(data))
            } else if (action === 'getOptions') {
              const optRes = await fetch(`${SINALITE_API_URL}/product/${productId}/${storeCode}`, {
                headers: { 'Authorization': `Bearer ${token}` },
              })
              if (!optRes.ok) throw new Error(`SinaLite API: ${optRes.statusText}`)
              const data = await optRes.json()
              const options = Array.isArray(data) ? data[0] : data.options || []
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.statusCode = 200
              res.end(JSON.stringify({ options }))
            } else {
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid action' }))
            }
          } catch (err) {
            console.error('[sinalite-price-proxy]', err.message)
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message || 'Failed to get price' }))
          }
        })
      })
    },
  }
}
