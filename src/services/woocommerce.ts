import type { WooCommerceProduct } from '../types'

const WOOCOMMERCE_STORE_URL = import.meta.env.VITE_WOOCOMMERCE_STORE_URL || 'https://printpowerpurpose.com'
const CONSUMER_KEY = import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY || 'ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192'
const CONSUMER_SECRET = import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET || 'cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7'

if (!CONSUMER_KEY || !CONSUMER_SECRET) {
  console.warn('WooCommerce credentials not configured')
}

// For development, use proxy. For production, use full URL
const getBaseUrl = () => {
  if (import.meta.env.DEV) {
    return '' // Use proxy in development
  }
  return WOOCOMMERCE_STORE_URL
}

// Basic Auth for WooCommerce REST API
const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)

export const woocommerceApi = {
  get baseUrl() {
    return `${getBaseUrl()}/wp-json/wc/v3`
  },
  
  async getProducts(params?: {
    page?: number
    per_page?: number
    category?: number
    search?: string
    featured?: boolean
  }): Promise<WooCommerceProduct[]> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString())
    if (params?.category) queryParams.append('category', params.category.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.featured !== undefined) queryParams.append('featured', params.featured.toString())

    const response = await fetch(`${this.baseUrl}/products?${queryParams}`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.statusText}`)
    }

    return response.json()
  },

  async getProduct(id: number): Promise<WooCommerceProduct> {
    const response = await fetch(`${this.baseUrl}/products/${id}`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.statusText}`)
    }

    return response.json()
  },

  async createOrder(orderData: {
    payment_method: string
    payment_method_title: string
    set_paid: boolean
    billing: {
      first_name: string
      last_name: string
      address_1: string
      address_2?: string
      city: string
      state: string
      postcode: string
      country: string
      email: string
      phone: string
    }
    shipping: {
      first_name: string
      last_name: string
      address_1: string
      address_2?: string
      city: string
      state: string
      postcode: string
      country: string
    }
    line_items: Array<{
      product_id: number
      quantity: number
      meta_data?: Array<{ key: string; value: any }>
    }>
    meta_data?: Array<{ key: string; value: any }>
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`WooCommerce API error: ${error}`)
    }

    return response.json()
  },

  async getCategories(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/products/categories`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.statusText}`)
    }

    return response.json()
  },
}
