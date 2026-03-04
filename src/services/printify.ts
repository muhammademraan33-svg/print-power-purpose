// Printify API service (for edge functions - not used directly in React)
// This is a reference for the API structure

export interface PrintifyShop {
  id: number
  title: string
  sales_channel: string
}

export interface PrintifyProduct {
  id: string
  title: string
  description: string
  tags: string[]
  options: Array<{
    name: string
    type: string
    values: Array<{
      id: number
      title: string
      colors?: string[]
    }>
  }>
  variants: Array<{
    id: number
    title: string
    options: Record<string, number>
    is_enabled: boolean
    is_default: boolean
    is_available: boolean
    price: number
    cost: number
    sku: string
  }>
  images: Array<{
    src: string
    variant_ids: number[]
    position: string
    is_default: boolean
  }>
  created_at: string
  updated_at: string
  visible: boolean
  is_locked: boolean
}

export interface PrintifyOrder {
  external_id: string
  label: string
  line_items: Array<{
    product_id: string
    variant_id: number
    quantity: number
  }>
  shipping_method: number
  send_shipping_notification: boolean
  address_to: {
    first_name: string
    last_name: string
    email: string
    phone: string
    country: string
    region: string
    address1: string
    city: string
    zip: string
  }
}

// Note: Actual API calls are made in Edge Functions, not in React
// This file is for type definitions only
