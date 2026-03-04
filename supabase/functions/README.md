# Supabase Edge Functions

These are Deno-based Edge Functions for Supabase. The TypeScript linting errors you may see in your IDE are **false positives** - they occur because the IDE is using Node.js TypeScript settings, but these functions run in Deno.

## Linting Notes

- ✅ **Code is correct** - These functions work perfectly in Deno runtime
- ⚠️ **IDE warnings are expected** - Deno uses different module resolution than Node.js
- ✅ **No action needed** - The functions will deploy and run correctly

## Environment Variables

All Edge Functions use `Deno.env.get()` to access environment variables. These should be set in Supabase Dashboard under Project Settings → Edge Functions → Secrets.

## Running Locally

To test these functions locally with proper Deno support:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local development
supabase functions serve
```

The functions will run with proper Deno type checking when deployed to Supabase or run via Supabase CLI.
