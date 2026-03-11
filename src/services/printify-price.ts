/**
 * Printify price from catalog (cost + markup via edge function).
 * Used on product detail when product has blueprintId and no stored price.
 */

export interface PrintifyPriceResponse {
  priceCents: number | null
  error?: string
}

export async function fetchPrintifyPrice(blueprintId: number): Promise<PrintifyPriceResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    return { priceCents: null, error: 'Supabase not configured' }
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/printify-price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blueprintId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { priceCents: null, error: data?.error || response.statusText }
  }
  return { priceCents: data?.priceCents ?? null, error: data?.error }
}
