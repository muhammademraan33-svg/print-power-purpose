// Simplified mock products for testing when WooCommerce store is empty
export const mockProducts = [
  {
    id: 1,
    name: 'Business Cards - Premium',
    slug: 'business-cards-premium',
    price: '49.99',
    regular_price: '49.99',
    on_sale: false,
    short_description: 'Premium business cards with matte or glossy finish',
    categories: [{ id: 1, name: 'Business Cards', slug: 'business-cards' }],
    images: [
      {
        id: 1,
        src: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500',
        name: 'Business Cards',
        alt: 'Premium Business Cards',
      },
    ],
  },
  {
    id: 2,
    name: 'Flyers - Full Color',
    slug: 'flyers-full-color',
    price: '89.99',
    regular_price: '89.99',
    on_sale: false,
    short_description: 'Full-color flyers on premium paper stock',
    categories: [{ id: 2, name: 'Flyers', slug: 'flyers' }],
    images: [
      {
        id: 2,
        src: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=500',
        name: 'Flyers',
        alt: 'Full Color Flyers',
      },
    ],
  },
  {
    id: 3,
    name: 'T-Shirt - Custom Print',
    slug: 't-shirt-custom-print',
    price: '24.99',
    regular_price: '29.99',
    sale_price: '24.99',
    on_sale: true,
    short_description: 'High-quality custom printed t-shirts',
    categories: [{ id: 3, name: 'Apparel', slug: 'apparel' }],
    images: [
      {
        id: 3,
        src: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
        name: 'T-Shirt',
        alt: 'Custom Print T-Shirt',
      },
    ],
  },
  {
    id: 4,
    name: 'Posters - Large Format',
    slug: 'posters-large-format',
    price: '129.99',
    regular_price: '129.99',
    on_sale: false,
    short_description: 'Professional large format posters',
    categories: [{ id: 4, name: 'Posters', slug: 'posters' }],
    images: [
      {
        id: 4,
        src: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
        name: 'Posters',
        alt: 'Large Format Posters',
      },
    ],
  },
]

export const mockCategories = [
  { id: 1, name: 'Business Cards', slug: 'business-cards', count: 1 },
  { id: 2, name: 'Flyers', slug: 'flyers', count: 1 },
  { id: 3, name: 'Apparel', slug: 'apparel', count: 1 },
  { id: 4, name: 'Posters', slug: 'posters', count: 1 },
]
