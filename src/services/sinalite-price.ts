// SinaLite Price API service
// Used for live pricing on product detail pages

export interface SinaLitePriceRequest {
  productOptions: number[]
  qty?: number
}

export interface SinaLitePriceResponse {
  price: string
  productOptions: Record<string, string>
  packageInfo: {
    'total weight': string
    'weight per box': string
    'Units Per Box': string
    'box size': string
    'number of boxes': string
  }
}

export const sinalitePriceApi = {
  async getProductOptions(productId: number, storeCode: string = 'en_ca'): Promise<any[]> {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const url = import.meta.env.DEV
      ? '/api/sinalite-price'
      : `${baseUrl}/functions/v1/sinalite-price`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getOptions',
        productId,
        storeCode,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get product options: ${response.statusText}`)
    }

    const data = await response.json()
    return data.options || []
  },

  async calculatePrice(
    productId: number,
    productOptions: number[],
    qty?: number,
    storeCode: string = 'en_ca'
  ): Promise<SinaLitePriceResponse> {
    const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_SUPABASE_URL || '')
    const url = import.meta.env.DEV
      ? '/api/sinalite-price'
      : `${baseUrl}/functions/v1/sinalite-price`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'calculatePrice',
        productId,
        productOptions,
        qty,
        storeCode,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to calculate price: ${response.statusText}`)
    }

    return response.json()
  },

  async getShippingEstimate(
    items: Array<{
      productId: number
      options: Record<string, string>
    }>,
    shippingInfo: {
      ShipState: string
      ShipCountry: string
      ShipZip: string
    }
  ): Promise<Array<[string, string, number, number]>> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/sinalite-shipping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        shippingInfo,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get shipping estimate: ${response.statusText}`)
    }

    const data = await response.json()
    return data.body || []
  },
}
