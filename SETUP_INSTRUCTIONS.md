# Complete Setup Instructions

## Step 1: Copy FPD Files

Copy these files from the `Fancyproductdesigner` folder to `public/fpd/`:

```
Fancyproductdesigner/fancy-product-designer/assets/js/FancyProductDesigner-all.min.js
→ print-power-purpose/public/fpd/FancyProductDesigner-all.min.js

Fancyproductdesigner/fancy-product-designer/assets/css/FancyProductDesigner-all.min.css
→ print-power-purpose/public/fpd/FancyProductDesigner-all.min.css
```

## Step 2: Install Dependencies

```bash
cd print-power-purpose
npm install
```

## Step 3: Set Up Supabase

1. Go to https://supabase.com and create a new project
2. In the SQL Editor, run the contents of `supabase/schema.sql`
3. Go to Storage and create a bucket named `artwork` (public access)
4. Note your Supabase URL and anon key

## Step 4: Configure Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WOOCOMMERCE_STORE_URL=https://printpowerpurpose.com
VITE_WOOCOMMERCE_CONSUMER_KEY=ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192
VITE_WOOCOMMERCE_CONSUMER_SECRET=cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Step 5: Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
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

# Set secrets
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
# ... (see README.md for all secrets)
```

## Step 6: Run Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173
