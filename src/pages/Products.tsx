import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, RefreshCw, Package, SlidersHorizontal, X, ChevronRight } from 'lucide-react'
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
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  return (
    <div className="min-h-screen bg-background">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary/8 via-background to-amber-50/30
                      border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Products</span>
          </nav>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
                Our Products
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl">
                Professional printing for every need. Every order automatically supports
                the nonprofit you choose.
              </p>
            </div>
            {hasProducts && (
              <div className="flex-shrink-0 text-sm text-muted-foreground bg-white/80
                              border border-border/60 rounded-xl px-4 py-2.5">
                <span className="font-semibold text-foreground">{typedData.count}</span> products
                {typedData.synced_at &&
                  <span> · synced {new Date(typedData.synced_at).toLocaleDateString()}</span>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Sync info strip ───────────────────────────────────────────── */}
        {hasProducts && (typedData.sinalite_count || typedData.printify_count) && (
          <div className="mb-6 flex items-center gap-3 p-3.5 bg-primary/5 rounded-xl
                          border border-primary/15 text-sm">
            <Package className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-muted-foreground">
              {typedData.sinalite_count ? (
                <><span className="font-semibold text-foreground">{typedData.sinalite_count}</span> SinaLite print products</>
              ) : null}
              {typedData.sinalite_count && typedData.printify_count ? ' · ' : ''}
              {typedData.printify_count ? (
                <><span className="font-semibold text-foreground">{typedData.printify_count}</span> Printify apparel items</>
              ) : null}
            </span>
            <Button variant="ghost" size="sm"
              className="ml-auto h-7 text-xs text-primary hover:text-primary whitespace-nowrap"
              onClick={() => (window.location.href = '/admin/sync')}>
              <RefreshCw className="mr-1.5 h-3 w-3" />Sync
            </Button>
          </div>
        )}

        {/* ── Search + Filters row ──────────────────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-border/60 focus:border-primary rounded-xl"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground
                           hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            className="sm:hidden h-11 gap-2 rounded-xl border-border/60"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {selectedCategory && <Badge className="ml-1 h-5 text-xs">1</Badge>}
          </Button>
        </div>

        <div className="flex gap-8">
          {/* ── Category sidebar (desktop) / expandable (mobile) ────────── */}
          <aside className={`${filtersOpen ? 'block' : 'hidden'} sm:block w-full sm:w-52 flex-shrink-0`}>
            <div className="bg-white rounded-2xl border border-border/50 p-5 shadow-sm sticky top-20">
              <h3 className="font-semibold text-sm mb-4 text-foreground/80 uppercase tracking-wide">
                Categories
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedCategory === null
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  All Products
                  <span className="float-right text-xs opacity-60">({typedData.count})</span>
                </button>
                {categories.map((cat) => {
                  const cnt = typedData.products.filter(p => p.category === cat).length
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {cat}
                      <span className="float-right text-xs opacity-60">({cnt})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          {/* ── Products grid ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Active filter chips */}
            {(search || selectedCategory) && (
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {displayed.length} result{displayed.length !== 1 ? 's' : ''}
                </span>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full
                               text-xs font-medium hover:bg-muted/80 transition-colors"
                  >
                    "{search}" <X className="h-3 w-3" />
                  </button>
                )}
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary
                               rounded-full text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    {selectedCategory} <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {displayed.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayed.map((product) => (
                  <Link
                    key={`${product.source || 'sinalite'}-${product.id}`}
                    to={`/products/${product.id}?source=${product.source || 'sinalite'}`}
                    className="product-card group block"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500
                                     group-hover:scale-110"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=400&q=80'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <Package className="h-10 w-10 text-muted-foreground/30" />
                          <span className="text-xs text-muted-foreground/50">{product.category}</span>
                        </div>
                      )}
                      {/* Source badge */}
                      {product.source === 'printify' && (
                        <span className="absolute top-3 left-3 badge-pill bg-purple-100 text-purple-700 border border-purple-200">
                          Apparel
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start gap-2 mb-1.5">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1 text-foreground
                                       group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {product.description.replace(/<[^>]*>/g, '')}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-3 border-t border-border/40">
                        <span className="text-xs font-medium text-muted-foreground bg-muted
                                         px-2.5 py-1 rounded-full">
                          {product.category}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          Get Quote →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
                  <Package className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                  {search || selectedCategory
                    ? 'Try adjusting your search or filters.'
                    : 'No products available. Run a sync to load products from SinaLite & Printify.'}
                </p>
                {!hasProducts ? (
                  <Button onClick={() => (window.location.href = '/admin/sync')} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Sync Products Now
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => { setSearch(''); setSelectedCategory(null) }}>
                    Clear Filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
