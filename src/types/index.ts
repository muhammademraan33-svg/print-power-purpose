export interface WooCommerceProduct {
  id: number
  name: string
  slug: string
  permalink: string
  type: 'simple' | 'variable' | 'grouped' | 'external'
  status: string
  featured: boolean
  catalog_visibility: string
  description: string
  short_description: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  on_sale: boolean
  purchasable: boolean
  total_sales: number
  virtual: boolean
  downloadable: boolean
  downloads: any[]
  download_limit: number
  download_expiry: number
  external_url: string
  button_text: string
  tax_status: string
  tax_class: string
  manage_stock: boolean
  stock_quantity: number | null
  stock_status: string
  backorders: string
  backorders_allowed: boolean
  backordered: boolean
  sold_individually: boolean
  weight: string
  dimensions: {
    length: string
    width: string
    height: string
  }
  shipping_required: boolean
  shipping_taxable: boolean
  shipping_class: string
  shipping_class_id: number
  reviews_allowed: boolean
  average_rating: string
  rating_count: number
  related_ids: number[]
  upsell_ids: number[]
  cross_sell_ids: number[]
  parent_id: number
  purchase_note: string
  categories: Array<{
    id: number
    name: string
    slug: string
  }>
  tags: Array<{
    id: number
    name: string
    slug: string
  }>
  images: Array<{
    id: number
    src: string
    name: string
    alt: string
  }>
  attributes: Array<{
    id: number
    name: string
    slug: string
    position: number
    visible: boolean
    variation: boolean
    options: string[]
  }>
  default_attributes: any[]
  variations: number[]
  grouped_products: number[]
  menu_order: number
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
  _links: any
}

export interface CartItem {
  id: string
  cartItemId: string
  productId: number
  name: string
  priceCents: number
  quantity: number
  imageUrl?: string
  configuration?: Record<string, any>
  artworkFileName?: string
  artworkUrl?: string
  vendor?: 'woocommerce' | 'sinalite' | 'printify'
  vendorProductId?: string
}

export interface Cause {
  id: string
  name: string
  summary: string
  icon: string
  raised_cents: number
  created_at: string
}

export interface Nonprofit {
  id: string
  name: string
  ein: string
  city: string
  state: string
  category?: string
  description?: string
  website?: string
  logo_url?: string
  is_verified: boolean
  is_active: boolean
  current_progress_cents: number
  milestone_count: number
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  user_id?: string
  session_id: string
  stripe_payment_intent_id?: string
  status: 'pending' | 'completed' | 'shipped' | 'cancelled'
  customer_email: string
  currency: string
  amount_total_cents: number
  subtotal_cents: number
  tax_cents: number
  donation_cents: number
  quantity: number
  items: CartItem[]
  product_name?: string
  cause_id?: string
  cause_name?: string
  nonprofit_id?: string
  nonprofit_name?: string
  nonprofit_ein?: string
  shipping_info: any
  billing_info: any
  sinalite_order_id?: string
  tracking_number?: string
  tracking_url?: string
  receipt_url?: string
  payment_mode: 'test' | 'live'
  paid_at?: string
  shipped_at?: string
  created_at: string
  updated_at: string
}

export interface Donation {
  id: string
  order_id: string
  cause_id?: string
  nonprofit_id?: string
  nonprofit_name: string
  nonprofit_ein: string
  amount_cents: number
  customer_email: string
  payout_status: 'pending' | 'processing' | 'paid'
  payout_date?: string
  created_at: string
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

export interface SinaLiteShippingOption {
  carrier: string
  service: string
  price: number
  estimatedDays: number
}
