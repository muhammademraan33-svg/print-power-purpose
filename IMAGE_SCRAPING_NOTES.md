# SinaLite Image Scraping Implementation

## Overview

Since the SinaLite API doesn't provide product images, I've implemented a web scraping solution to fetch product images directly from SinaLite.com.

## Implementation

### Edge Function: `sync-sinalite-images`

**Location:** `supabase/functions/sync-sinalite-images/index.ts`

**Features:**
- Scrapes SinaLite.com for individual product images
- Searches for products by name
- Extracts images from product pages
- Filters out category icons (only accepts product-level images)
- Supports single product or batch processing
- Rate limiting (1 second delay between requests)

### How It Works

1. **Search Phase:**
   - Searches SinaLite.com: `https://sinalite.com/en_us/catalogsearch/result/?q={product_name}`
   - Finds product page links in search results

2. **Extraction Phase:**
   - Fetches the individual product page
   - Tries multiple methods to extract image:
     - `og:image` meta tag (preferred)
     - Product gallery images
     - Main product image

3. **Validation Phase:**
   - Only accepts images from `/media/catalog/product/`
   - Rejects category icons from `/media/catalog/category/`
   - Ensures image URL is valid

4. **Storage Phase:**
   - Updates product record in database with `image_url`

### Usage

#### Single Product
```typescript
POST /functions/v1/sync-sinalite-images
{
  "productId": "uuid-here"
}
```

#### Batch Processing
```typescript
POST /functions/v1/sync-sinalite-images
{
  "batch": true
}
```

Batch mode processes up to 50 products at a time that are missing images.

### Admin Interface

An admin page is available at `/admin/image-sync` to:
- Sync products from SinaLite API
- Scrape images for products missing images
- View sync results

### Rate Limiting

The scraper includes a 1-second delay between requests to:
- Avoid overwhelming SinaLite.com servers
- Reduce risk of being blocked
- Be respectful of their resources

### Error Handling

- Handles network errors gracefully
- Logs errors for debugging
- Continues processing even if individual products fail
- Returns detailed results for each product

### Important Notes

⚠️ **Web Scraping Considerations:**
- Scraping may be blocked if done too aggressively
- SinaLite.com structure may change, requiring updates
- Rate limiting is essential to avoid being blocked
- Always check robots.txt and terms of service

### Alternative Approaches

If scraping becomes problematic:
1. **Manual Image Upload:** Admin can upload images manually
2. **Image API:** Check if SinaLite offers image API separately
3. **Third-party Service:** Use image search APIs
4. **WooCommerce Images:** Use WooCommerce product images if available

### Testing

To test the image scraping:
1. Ensure you have products in the database (run `sync-sinalite` first)
2. Navigate to `/admin/image-sync`
3. Click "Scrape Images from SinaLite.com"
4. Monitor the results

### Future Improvements

- [ ] Cache scraped images to avoid re-scraping
- [ ] Implement retry logic for failed scrapes
- [ ] Add image validation (size, format, etc.)
- [ ] Support for multiple images per product
- [ ] Background job processing for large batches
