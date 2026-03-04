#!/usr/bin/env node
/**
 * Setup script to create .env file with API keys from conversation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envContent = `# Supabase Configuration
# Get these from: https://supabase.com/dashboard/project/cdglodnhpopswiodxizy/settings/api
VITE_SUPABASE_URL=https://cdglodnhpopswiodxizy.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# WooCommerce Configuration (from conversation)
VITE_WOOCOMMERCE_STORE_URL=https://printpowerpurpose.com
VITE_WOOCOMMERCE_CONSUMER_KEY=ck_55f6a955fbad21332ab2a4f3e36d280a50ca3192
VITE_WOOCOMMERCE_CONSUMER_SECRET=cs_907cdc5070a5a06bad15c6b2fe53c9a3536d6fb7

# Stripe Configuration (Frontend)
# Get from: https://dashboard.stripe.com/apikeys
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
`;

const envPath = path.join(__dirname, '.env');

try {
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists. Backing up to .env.backup');
    fs.copyFileSync(envPath, path.join(__dirname, '.env.backup'));
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('\n📝 Next steps:');
  console.log('1. Get Supabase keys from: https://supabase.com/dashboard/project/cdglodnhpopswiodxizy/settings/api');
  console.log('2. Get Stripe publishable key from: https://dashboard.stripe.com/apikeys');
  console.log('3. Update the .env file with these keys');
  console.log('\n✅ WooCommerce keys are already configured!');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  process.exit(1);
}
