# Print Power Purpose - E-Commerce Print Shop

A complete e-commerce print shop that donates $10 for every $50 spent to the nonprofit of the customer's choice.

## Architecture

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Product Catalog:** WooCommerce (headless REST API)
- **Payments:** Stripe Checkout
- **Fulfillment:** SinaLite API (print products) + Printify API (apparel)
- **Product Designer:** Fancy Product Designer (standalone JS)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# WooCommerce
VITE_WOOCOMMERCE_STORE_URL=https://printpowerpurpose.com
VITE_WOOCOMMERCE_CONSUMER_KEY=ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192
VITE_WOOCOMMERCE_CONSUMER_SECRET=cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### 3. Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Run the SQL schema from `supabase/schema.sql` in the Supabase SQL editor
3. Create a storage bucket named `artwork` for artwork uploads
4. Set up Edge Functions (see below)

### 4. Supabase Edge Functions

Deploy the Edge Functions from `supabase/functions/`:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy place-sinalite-order
supabase functions deploy place-printify-order
supabase functions deploy upload-artwork
supabase functions deploy sync-sinalite
supabase functions deploy sync-sinalite-images
supabase functions deploy search-nonprofits
supabase functions deploy import-pub78
```

Set the following secrets in Supabase:

```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SINALITE_CLIENT_ID_TEST=jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H
supabase secrets set SINALITE_CLIENT_SECRET_TEST=nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b
supabase secrets set SINALITE_AUDIENCE_TEST=https://apiconnect.sinalite.com
supabase secrets set SINALITE_AUTH_URL_TEST=https://api.sinaliteuppy.com
supabase secrets set SINALITE_API_URL_TEST=https://api.sinaliteuppy.com
supabase secrets set WOOCOMMERCE_STORE_URL=https://printpowerpurpose.com
supabase secrets set WOOCOMMERCE_CONSUMER_KEY=ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192
supabase secrets set WOOCOMMERCE_CONSUMER_SECRET=cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7
```

### 5. Fancy Product Designer Setup

Copy the FPD files to `public/fpd/`:

```bash
# Copy from the Fancyproductdesigner folder
cp Fancyproductdesigner/fancy-product-designer/assets/js/FancyProductDesigner-all.min.js public/fpd/
cp Fancyproductdesigner/fancy-product-designer/assets/css/FancyProductDesigner-all.min.css public/fpd/
```

### 6. Stripe Webhook Setup

1. Create a Stripe webhook endpoint pointing to:
   `https://your-project.supabase.co/functions/v1/stripe-webhook`
2. Select event: `checkout.session.completed`
3. Copy the webhook signing secret and add it to Supabase secrets

### 7. Run Development Server

```bash
npm run dev
```

## Features

- ✅ Product catalog from WooCommerce
- ✅ SinaLite product sync from API
- ✅ **SinaLite image scraping** from SinaLite.com (since API doesn't provide images)
- ✅ Shopping cart with localStorage persistence
- ✅ Fancy Product Designer integration
- ✅ Artwork upload with bleed warning
- ✅ Nonprofit search (IRS Pub78)
- ✅ Donation calculation ($10 per $50)
- ✅ Donation barometer UI
- ✅ Stripe Checkout integration
- ✅ Order management
- ✅ WooCommerce order creation
- ✅ SinaLite fulfillment integration
- ✅ Printify fulfillment integration
- ✅ Admin image sync interface

## Project Structure

```
print-power-purpose/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts (Cart, Cause)
│   ├── pages/          # Page components
│   ├── services/       # API clients (Supabase, WooCommerce, Stripe)
│   ├── types/          # TypeScript types
│   └── lib/            # Utility functions
├── supabase/
│   ├── schema.sql      # Database schema
│   └── functions/      # Edge Functions
├── public/
│   └── fpd/            # Fancy Product Designer files
└── package.json
```

## Database Schema

See `supabase/schema.sql` for the complete database schema including:
- `causes` - Curated cause categories
- `nonprofits` - IRS Pub78 nonprofit database
- `orders` - Order records
- `donations` - Donation tracking
- `profiles` - User profiles
- `pricing_rules` - Pricing configuration
- `app_settings` - Application settings

## API Integrations

### WooCommerce REST API
- Fetch products
- Create orders
- Get categories

### SinaLite API
- OAuth2 authentication
- Product catalog
- Price calculation
- Order placement

### Stripe
- Checkout Sessions
- Webhook handling
- Payment processing

## License

Private - All rights reserved
