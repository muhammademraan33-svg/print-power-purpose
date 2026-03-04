# Supabase Secrets Setup Guide

## ⚠️ IMPORTANT: Manual Step Required

These secrets MUST be set in Supabase Dashboard because Edge Functions need them. They cannot be in `.env` files.

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard
- Visit: https://supabase.com/dashboard
- Login and select project: `cdglodnhpopswiodxizy`

### 2. Navigate to Secrets
- Go to: **Settings** → **Edge Functions** → **Secrets**
- Or direct link: `https://supabase.com/dashboard/project/cdglodnhpopswiodxizy/settings/functions`

### 3. Add Each Secret

Click "Add new secret" for each one below:

#### SinaLite API (Sandbox/Test)
```
Name: SINALITE_CLIENT_ID_TEST
Value: jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H

Name: SINALITE_CLIENT_SECRET_TEST
Value: nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b

Name: SINALITE_AUDIENCE_TEST
Value: https://apiconnect.sinalite.com

Name: SINALITE_AUTH_URL_TEST
Value: https://api.sinaliteuppy.com

Name: SINALITE_API_URL_TEST
Value: https://api.sinaliteuppy.com
```

#### Printify API
```
Name: PRINTIFY_API_KEY
Value: eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6IjA4ZDBkMjlhYWNkMjIzMzA0OGYxM2U0ZjczNGRhYjY4YjQ5ZGQ3ODdiNTM4ZjdiZDlmYjk0YzU4MzVhMmQ3ZTllNmQzM2Q2MGExNGJlZWRlIiwiaWF0IjoxNzcyNTE0Nzg0LjEzMTQ4OCwibmJmIjoxNzcyNTE0Nzg0LjEzMTQ5LCJleHAiOjE4MDQwNTA3ODQuMTI1MjM4LCJzdWIiOiIyMTI2NzU0NSIsInNjb3BlcyI6WyJzaG9wcy5tY...

Note: The Printify token is truncated in the conversation. You'll need to get the full token from:
- Printify Dashboard → Settings → API
- Or use the token provided in the conversation (it may be complete)
```

#### WooCommerce (for Edge Functions)
```
Name: WOOCOMMERCE_STORE_URL
Value: https://printpowerpurpose.com

Name: WOOCOMMERCE_CONSUMER_KEY
Value: ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192

Name: WOOCOMMERCE_CONSUMER_SECRET
Value: cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7
```

#### Stripe (Get from Stripe Dashboard)
```
Name: STRIPE_SECRET_KEY_TEST
Value: sk_test_... (Get from https://dashboard.stripe.com/test/apikeys)

Name: STRIPE_SECRET_KEY_LIVE
Value: sk_live_... (Get from https://dashboard.stripe.com/apikeys)

Name: STRIPE_WEBHOOK_SECRET
Value: whsec_... (Get after creating webhook at https://dashboard.stripe.com/webhooks)
```

## ✅ Already Configured in Code (Fallback Values)

The following have been set as fallback values in the code, but you should still add them to Supabase Secrets for production:

- ✅ SinaLite credentials (fallback values set)
- ✅ WooCommerce credentials (fallback values set)
- ⚠️ Printify token (partial - needs full token)
- ❌ Stripe keys (need to be obtained)

## Quick Copy-Paste for Supabase Dashboard

Copy this entire block and paste into Supabase Secrets (one secret per line):

```
SINALITE_CLIENT_ID_TEST=jJ3mdtSsQmOxdsGqcsx66DzXSPgcln9H
SINALITE_CLIENT_SECRET_TEST=nj9mgymvK4piB0YMnjWLr_MaidMdDhxtmbDDk43qhI_HFKK4gTKIKfaktw20Kf-b
SINALITE_AUDIENCE_TEST=https://apiconnect.sinalite.com
SINALITE_AUTH_URL_TEST=https://api.sinaliteuppy.com
SINALITE_API_URL_TEST=https://api.sinaliteuppy.com
WOOCOMMERCE_STORE_URL=https://printpowerpurpose.com
WOOCOMMERCE_CONSUMER_KEY=ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192
WOOCOMMERCE_CONSUMER_SECRET=cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7
```

Note: You'll need to add these one by one in Supabase Dashboard (they don't support bulk import).
