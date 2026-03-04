// SinaLite API service (for edge functions - not used directly in React)
// This is a reference for the API structure

export interface SinaLiteAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface SinaLiteProduct {
  id: number
  sku: string
  name: string
  category: string
  enabled: number
}

export interface SinaLiteProductOption {
  id: number
  group: string
  name: string
  hidden: number
}

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

export interface SinaLiteShippingEstimate {
  items: Array<{
    productId: number
    options: Record<string, string>
  }>
  shippingInfo: {
    ShipState: string
    ShipCountry: string
    ShipZip: string
  }
}

export interface SinaLiteShippingOption {
  carrier: string
  service: string
  price: number
  estimatedDays: number
}

export interface SinaLiteOrder {
  items: Array<{
    productId: number
    options: Record<string, string>
    files: Array<{
      type: string
      url: string
    }>
  }>
  shippingInfo: {
    ShipFName: string
    ShipLName: string
    ShipEmail: string
    ShipAddr: string
    ShipAddr2?: string
    ShipCity: string
    ShipState: string
    ShipZip: string
    ShipCountry: string
    ShipPhone: string
    ShipMethod: string
  }
  billingInfo: {
    BillFName: string
    BillLName: string
    BillEmail: string
    BillAddr: string
    BillAddr2?: string
    BillCity: string
    BillState: string
    BillZip: string
    BillCountry: string
    BillPhone: string
  }
  notes?: string
}

// Note: Actual API calls are made in Edge Functions, not in React
// This file is for type definitions only
