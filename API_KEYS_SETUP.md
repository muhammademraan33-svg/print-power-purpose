# API Keys Configuration

## ✅ Automatically Configured (Frontend .env)

The following keys have been placed in `.env.example` and should be copied to your `.env` file:

### WooCommerce (Frontend)
- ✅ `VITE_WOOCOMMERCE_STORE_URL=https://printpowerpurpose.com`
- ✅ `VITE_WOOCOMMERCE_CONSUMER_KEY=ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192`
- ✅ `VITE_WOOCOMMERCE_CONSUMER_SECRET=cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7`

## ⚠️ Manual Steps Required (Supabase Secrets)

These secrets MUST be set in Supabase Dashboard (not in .env file) because they're used by Edge Functions:

### Steps to Set Supabase Secrets:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `cdglodnhpopswiodxizy`
3. Navigate to: **Settings** → **Edge Functions** → **Secrets**
4. Add each secret below:

### SinaLite API (Sandbox/Test)
```
SINALITE_CLIENT_ID_TEST = jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H
SINALITE_CLIENT_SECRET_TEST = nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b
SINALITE_AUDIENCE_TEST = https://apiconnect.sinalite.com
SINALITE_AUTH_URL_TEST = https://api.sinaliteuppy.com
SINALITE_API_URL_TEST = https://api.sinaliteuppy.com
```

### Printify API
```
PRINTIFY_API_KEY = eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6IjA4ZDBkMjlhYWNkMjIzMzA0OGYxM2U0ZjczNGRhYjY4YjQ5ZGQ3ODdiNTM4ZjdiZDlmYjk0YzU4MzVhMmQ3ZTllNmQzM2Q2MGExNGJlZWRlIiwiaWF0IjoxNzcyNTE0Nzg0LjEzMTQ4OCwibmJmIjoxNzcyNTE0Nzg0LjEzMTQ5LCJleHAiOjE4MDQwNTA3ODQuMTI1MjM4LCJzdWIiOiIyMTI2NzU0NSIsInNjb3BlcyI6WyJzaG9wcy5tY...
PRINTIFY_SHOP_ID = (You'll need to get this from Printify dashboard - see below)
```

### WooCommerce (for Edge Functions)
```
WOOCOMMERCE_STORE_URL = https://printpowerpurpose.com
WOOCOMMERCE_CONSUMER_KEY = ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192
WOOCOMMERCE_CONSUMER_SECRET = cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7
```

### Stripe (You'll need to get these from Stripe Dashboard)
```
STRIPE_SECRET_KEY_TEST = sk_test_... (Get from Stripe Dashboard)
STRIPE_SECRET_KEY_LIVE = sk_live_... (Get from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET = whsec_... (Get from Stripe Dashboard after creating webhook)
```

## 📋 Additional Setup Needed

### 1. Printify Shop ID
- Log into Printify: https://printify.com
- Go to your shop settings
- Copy the Shop ID (usually visible in the URL or shop settings)

### 2. Stripe Keys
- Log into Stripe Dashboard: https://dashboard.stripe.com
- Go to **Developers** → **API keys**
- Copy:
  - **Publishable key** → Put in `.env` as `VITE_STRIPE_PUBLISHABLE_KEY`
  - **Secret key (test)** → Put in Supabase Secrets as `STRIPE_SECRET_KEY_TEST`
  - **Secret key (live)** → Put in Supabase Secrets as `STRIPE_SECRET_KEY_LIVE`
- Create webhook endpoint pointing to: `https://[your-supabase-url]/functions/v1/stripe-webhook`
- Copy webhook signing secret → Put in Supabase Secrets as `STRIPE_WEBHOOK_SECRET`

### 3. Supabase Keys
- Log into Supabase Dashboard
- Go to **Settings** → **API**
- Copy:
  - **Project URL** → Put in `.env` as `VITE_SUPABASE_URL`
  - **anon public key** → Put in `.env` as `VITE_SUPABASE_ANON_KEY`

## 🚀 Quick Start

1. **Copy `.env.example` to `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in missing values in `.env`:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY`

3. **Set Supabase Secrets** (as described above)

4. **Get Printify Shop ID** and add to Supabase Secrets

5. **Get Stripe keys** and add to both `.env` and Supabase Secrets

## ✅ Already Configured

- ✅ WooCommerce REST API credentials (frontend)
- ✅ SinaLite API credentials (structure ready)
- ✅ Printify API token (structure ready)
