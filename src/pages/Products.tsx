import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Search, X, ChevronRight, Package } from 'lucide-react'
import sinaliteData from '@/data/sinaliteProducts.json'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductOption { name: string; values: string[] }
interface SinaliteProduct {
  id: number | string
  sku: string
  name: string
  category: string
  image: string | null
  description?: string
  options?: ProductOption[]
  source?: 'sinalite' | 'printify' | 'mock'
  shopId?: string
}
interface SinaliteData {
  synced_at: string | null
  count: number
  sinalite_count?: number
  printify_count?: number
  products: SinaliteProduct[]
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Products() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const typedData = sinaliteData as unknown as SinaliteData
  const hasProducts = typedData.products && typedData.products.length > 0

  const categories: string[] = useMemo(() => {
    if (!hasProducts) return []
    return [...new Set(typedData.products.map(p => p.category).filter(Boolean))].sort()
  }, [hasProducts, typedData.products])

  const displayed = useMemo(() => {
    if (!hasProducts) return []
    let list = typedData.products
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    if (selectedCategory) list = list.filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase())
    return list
  }, [hasProducts, typedData.products, search, selectedCategory])

  // One representative product per category (for the category circles at the top)
  const categoryCircles = useMemo(() => {
    if (!hasProducts) return []
    const seen = new Set<string>()
    const result: { cat: string; image: string | null }[] = []
    for (const p of typedData.products) {
      if (!seen.has(p.category)) {
        seen.add(p.category)
        result.push({ cat: p.category, image: p.image ?? null })
      }
    }
    return result.slice(0, 16) // Show at most 16 categories as circles
  }, [hasProducts, typedData.products])

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Products</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1">
            Print Products
          </h1>
          <p className="text-muted-foreground text-base">
            Every order supports the nonprofit you choose.
            {hasProducts && <span className="ml-2 text-sm font-medium text-primary">{typedData.count} products available</span>}
          </p>
        </div>
      </div>

      {/* ── Category Circles (Vistaprint-style) ───────────────────────── */}
      {!selectedCategory && !search && categoryCircles.length > 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h2 className="text-lg font-bold mb-6 text-gray-800">Shop by Category</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 sm:gap-6">
              {categoryCircles.map(({ cat, image }) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="group flex flex-col items-center gap-2.5 text-center"
                >
                  {/* Circle */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-100
                                  ring-2 ring-transparent group-hover:ring-primary/40
                                  shadow-sm group-hover:shadow-md transition-all duration-200
                                  group-hover:scale-105">
                    {image ? (
                      <img
                        src={image}
                        alt={cat}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <Package className="w-6 h-6 text-primary/50" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-700 group-hover:text-primary
                                   leading-tight transition-colors line-clamp-2 w-16 sm:w-20">
                    {cat}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Search + active category filter ────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-gray-200 focus:border-primary rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Active filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground
                           rounded-full text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                {selectedCategory} <X className="h-3 w-3 ml-0.5" />
              </button>
            )}
            {(search || selectedCategory) && (
              <span className="text-sm text-muted-foreground">
                {displayed.length} result{displayed.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Category pills row (when one is selected or searching) ─── */}
        {(search || selectedCategory) && categories.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                !selectedCategory ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
              }`}
            >All</button>
            {categories.map(cat => (
              <button key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedCategory === cat ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                }`}
              >{cat}</button>
            ))}
          </div>
        )}

        {/* ── Products grid — Vistaprint-style circles ──────────────── */}
        {displayed.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {displayed.map((product) => (
              <Link
                key={`${product.source || 'sinalite'}-${product.id}`}
                to={`/products/${product.id}?source=${product.source || 'sinalite'}`}
                className="group flex flex-col items-center text-center gap-2.5 py-2"
              >
                {/* Circle image */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-white
                                border-2 border-gray-100 group-hover:border-primary/30
                                shadow-sm group-hover:shadow-md transition-all duration-200
                                group-hover:scale-105">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=300&q=80'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 gap-1">
                      <Package className="h-8 w-8 text-gray-300" />
                    </div>
                  )}

                  {/* Apparel badge */}
                  {product.source === 'printify' && (
                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-purple-500
                                    flex items-center justify-center shadow">
                      <span className="text-white text-[8px] font-bold">APP</span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-primary
                                 transition-colors leading-snug line-clamp-2 max-w-[7rem] sm:max-w-[8rem]">
                    {product.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">
                    {product.category}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
              <Package className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              {search || selectedCategory
                ? 'Try adjusting your search or clearing the filter.'
                : 'No products available. Run a sync to load products from SinaLite & Printify.'}
            </p>
            <button
              onClick={() => { setSearch(''); setSelectedCategory(null) }}
              className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium
                         hover:bg-primary/90 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
