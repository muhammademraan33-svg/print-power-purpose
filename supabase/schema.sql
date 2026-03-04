-- Print Power Purpose Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table (for SinaLite products synced from API)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor TEXT NOT NULL DEFAULT 'sinalite',
  vendor_product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  sku TEXT,
  image_url TEXT,
  additional_images TEXT[],
  base_cost_cents INTEGER,
  min_price_cents INTEGER,
  min_price_variant_key TEXT,
  markup_percent INTEGER,
  retail_price_cents INTEGER,
  store_code INTEGER DEFAULT 9,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor, vendor_product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products(vendor, vendor_product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active) WHERE is_active = true;

-- Causes table (curated categories)
CREATE TABLE IF NOT EXISTS public.causes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  summary TEXT,
  icon TEXT,
  raised_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nonprofits table (IRS Pub78 data)
CREATE TABLE IF NOT EXISTS public.nonprofits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  ein TEXT,
  city TEXT,
  state TEXT,
  category TEXT,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  submitted_by UUID,
  current_progress_cents BIGINT DEFAULT 0,
  milestone_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for nonprofit search
CREATE INDEX IF NOT EXISTS idx_nonprofits_search ON public.nonprofits USING gin(to_tsvector('english', name || ' ' || COALESCE(city, '') || ' ' || COALESCE(state, '') || ' ' || COALESCE(ein, '')));
CREATE INDEX IF NOT EXISTS idx_nonprofits_ein ON public.nonprofits(ein);
CREATE INDEX IF NOT EXISTS idx_nonprofits_active ON public.nonprofits(is_active) WHERE is_active = true;

-- Full-text search function for nonprofits
CREATE OR REPLACE FUNCTION public.search_nonprofits_fts(search_term TEXT, result_limit INTEGER DEFAULT 50)
RETURNS SETOF public.nonprofits AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.nonprofits
  WHERE is_active = true
    AND (
      to_tsvector('english', name || ' ' || COALESCE(city, '') || ' ' || COALESCE(state, '') || ' ' || COALESCE(ein, '')) 
      @@ plainto_tsquery('english', search_term)
      OR name ILIKE '%' || search_term || '%'
      OR city ILIKE '%' || search_term || '%'
      OR state ILIKE '%' || search_term || '%'
      OR ein ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE 
      WHEN name ILIKE search_term || '%' THEN 1
      WHEN name ILIKE '%' || search_term || '%' THEN 2
      ELSE 3
    END,
    name
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID,
  session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'shipped', 'cancelled')),
  customer_email TEXT NOT NULL,
  currency TEXT DEFAULT 'usd',
  amount_total_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER DEFAULT 0,
  donation_cents INTEGER DEFAULT 0,
  quantity INTEGER NOT NULL,
  items JSONB NOT NULL,
  product_name TEXT,
  cause_id UUID REFERENCES public.causes(id),
  cause_name TEXT,
  nonprofit_id UUID REFERENCES public.nonprofits(id),
  nonprofit_name TEXT,
  nonprofit_ein TEXT,
  shipping_info JSONB,
  billing_info JSONB,
  sinalite_order_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  receipt_url TEXT,
  payment_mode TEXT DEFAULT 'test' CHECK (payment_mode IN ('test', 'live')),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donations table
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  cause_id UUID REFERENCES public.causes(id),
  nonprofit_id UUID REFERENCES public.nonprofits(id),
  nonprofit_name TEXT NOT NULL,
  nonprofit_ein TEXT,
  amount_cents INTEGER NOT NULL,
  customer_email TEXT,
  payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid')),
  payout_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE,
  email TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing rules table
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  category TEXT,
  product_id UUID,
  markup_percent INTEGER,
  fixed_amount_cents INTEGER,
  min_price_cents INTEGER,
  max_price_cents INTEGER,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default app settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('default_markup_percent', '100', 'Default markup % on base cost (100 = 2x)'),
  ('donation_rule', '{"per":5000,"donation":1000}', '$10 donated per $50 spent (values in cents)'),
  ('store_code', '9', 'SinaLite store: 9=US, 6=Canada'),
  ('stripe_mode', 'test', 'Stripe mode: test or live')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Insert default causes
INSERT INTO public.causes (name, summary, icon) VALUES
  ('Schools', 'Support education and schools in your community', '🏫'),
  ('Nonprofits', 'General nonprofit organizations making a difference', '💚')
ON CONFLICT DO NOTHING;

-- Function to increment cause raised amount
CREATE OR REPLACE FUNCTION increment_cause_raised(cause_uuid UUID, amount_cents BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.causes
  SET raised_cents = raised_cents + amount_cents
  WHERE id = cause_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to update nonprofit progress
CREATE OR REPLACE FUNCTION update_nonprofit_progress(nonprofit_uuid UUID, amount_cents BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.nonprofits
  SET 
    current_progress_cents = current_progress_cents + amount_cents,
    updated_at = NOW()
  WHERE id = nonprofit_uuid;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nonprofits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Causes: Everyone can read
CREATE POLICY "Causes are viewable by everyone" ON public.causes
  FOR SELECT USING (true);

-- Nonprofits: Everyone can read active ones
CREATE POLICY "Nonprofits are viewable by everyone" ON public.nonprofits
  FOR SELECT USING (is_active = true);

-- Orders: Users can view their own orders
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR true); -- Allow guest orders too

-- Donations: Everyone can read
CREATE POLICY "Donations are viewable by everyone" ON public.donations
  FOR SELECT USING (true);

-- Profiles: Everyone can read, users can update own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Pricing rules: Everyone can read
CREATE POLICY "Pricing rules are viewable by everyone" ON public.pricing_rules
  FOR SELECT USING (true);

-- Products: Everyone can read
CREATE POLICY "Products are viewable by everyone" ON public.products
  FOR SELECT USING (true);

-- App settings: Everyone can read
CREATE POLICY "App settings are viewable by everyone" ON public.app_settings
  FOR SELECT USING (true);
