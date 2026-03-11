import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCause } from '@/contexts/CauseContext'
import { supabase } from '@/services/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search, Loader2, Check, ChevronRight, Heart,
  MapPin, Building2, ArrowRight,
} from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import type { Cause, Nonprofit } from '@/types'

export default function Causes() {
  const navigate = useNavigate()
  const { selectedCause, selectedNonprofit, setSelectedCause, setSelectedNonprofit } = useCause()
  const [searchQuery, setSearchQuery]     = useState('')
  const [selectedCauseId, setSelectedCauseId] = useState<string | null>(selectedCause?.id || null)

  // Default causes when Supabase is empty or unavailable
  const DEFAULT_CAUSES: Cause[] = [
    { id: 'education', name: 'Education', summary: 'Support schools, scholarships, and literacy programs.', icon: '📚', raised_cents: 0, created_at: new Date().toISOString() },
    { id: 'health', name: 'Health & Wellness', summary: 'Fund medical research, mental health, and community wellness.', icon: '🏥', raised_cents: 0, created_at: new Date().toISOString() },
    { id: 'environment', name: 'Environment', summary: 'Protect wildlife, clean oceans, and combat climate change.', icon: '🌍', raised_cents: 0, created_at: new Date().toISOString() },
    { id: 'community', name: 'Community', summary: 'Help homeless, food banks, and local outreach programs.', icon: '🤝', raised_cents: 0, created_at: new Date().toISOString() },
    { id: 'animals', name: 'Animals', summary: 'Support shelters, rescue groups, and animal welfare.', icon: '🐾', raised_cents: 0, created_at: new Date().toISOString() },
  ]

  const { data: causesData, isLoading: causesLoading } = useQuery({
    queryKey: ['causes'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('causes').select('*').order('name')
        if (error) throw error
        return (data?.length ? data : DEFAULT_CAUSES) as Cause[]
      } catch {
        return DEFAULT_CAUSES
      }
    },
  })
  const causes = causesData ?? DEFAULT_CAUSES

  // Search nonprofits
  const { data: nonprofits, isLoading: nonprofitsLoading } = useQuery({
    queryKey: ['nonprofits', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const response = await fetch(`${supabaseUrl}/functions/v1/search-nonprofits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, limit: 50 }),
        })
        if (!response.ok) {
          const { data, error } = await supabase
            .from('nonprofits').select('*')
            .or(`name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,state.ilike.%${searchQuery}%,ein.ilike.%${searchQuery}%`)
            .eq('is_active', true).limit(50)
          if (error) throw error
          return data as Nonprofit[]
        }
        const result = await response.json()
        return result.nonprofits || []
      } catch {
        const { data, error: dbError } = await supabase
          .from('nonprofits').select('*')
          .or(`name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,state.ilike.%${searchQuery}%,ein.ilike.%${searchQuery}%`)
          .eq('is_active', true).limit(50)
        if (dbError) throw dbError
        return data as Nonprofit[]
      }
    },
    enabled: searchQuery.length >= 2,
  })

  const handleSelectCause = (cause: Cause) => {
    setSelectedCause(cause); setSelectedCauseId(cause.id)
    setSearchQuery(''); setSelectedNonprofit(null)
  }

  const handleSelectNonprofit = (nonprofit: Nonprofit) => {
    setSelectedNonprofit(nonprofit)
    toast(`Selected ${nonprofit.name}`, 'success')
  }

  const currentCauseName = causes?.find(c => c.id === selectedCauseId)?.name || ''

  return (
    <div className="min-h-screen bg-background">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-rose-50/60 via-background to-primary/5
                      border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Choose a Cause</span>
          </nav>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                            bg-rose-100 text-rose-700 text-xs font-bold mb-5">
              <Heart className="w-3.5 h-3.5 fill-current" />
              Give Back with Every Order
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
              Choose Your Cause
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Pick a cause category, then find a specific nonprofit to support.
              We'll automatically donate{' '}
              <strong className="text-foreground">$10 for every $50</strong> you spend.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-5xl">

        {/* ── Step 1: Cause categories ─────────────────────────────────── */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground
                            flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="text-xl font-bold">Select a Category</h2>
          </div>

          {causesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : causes && causes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {causes.map((cause) => {
                const isSelected = selectedCauseId === cause.id
                return (
                  <button
                    key={cause.id}
                    onClick={() => handleSelectCause(cause)}
                    className={`group relative text-left rounded-2xl border-2 p-6 transition-all
                                hover:shadow-lg ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-white hover:border-primary/40 shadow-sm'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary
                                      flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className="text-4xl mb-3">{cause.icon}</div>
                    <h3 className={`font-bold text-base mb-1.5 ${
                      isSelected ? 'text-primary' : 'text-foreground'
                    }`}>
                      {cause.name}
                    </h3>
                    {cause.summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                        {cause.summary}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        ${(cause.raised_cents / 100).toLocaleString()} raised
                      </span>
                      {isSelected && (
                        <Badge className="text-xs bg-primary/10 text-primary border-0">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-border/50">
              <p className="text-muted-foreground">No causes available yet.</p>
            </div>
          )}
        </div>

        {/* ── Step 2: Nonprofit search ─────────────────────────────────── */}
        {selectedCauseId && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground
                              flex items-center justify-center text-sm font-bold">2</div>
              <h2 className="text-xl font-bold">
                Find a Nonprofit
                {currentCauseName && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    in {currentCauseName}
                  </span>
                )}
              </h2>
            </div>

            <div className="relative mb-5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, city, state, or EIN…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 bg-white border-border/60 rounded-xl text-base
                           focus:border-primary"
              />
            </div>

            {nonprofitsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : nonprofits && nonprofits.length > 0 ? (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {nonprofits.map((nonprofit: Nonprofit) => {
                  const isSelected = selectedNonprofit?.id === nonprofit.id
                  return (
                    <button
                      key={nonprofit.id}
                      onClick={() => handleSelectNonprofit(nonprofit)}
                      className={`w-full text-left rounded-xl border transition-all p-4 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-white hover:border-primary/40 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className={`font-semibold text-sm ${
                              isSelected ? 'text-primary' : 'text-foreground'
                            }`}>
                              {nonprofit.name}
                            </h4>
                            {nonprofit.is_verified && (
                              <Badge variant="secondary" className="text-xs h-5">Verified</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {nonprofit.city}, {nonprofit.state}
                            {nonprofit.ein && (
                              <>
                                <span className="text-border mx-1">·</span>
                                <Building2 className="w-3 h-3 flex-shrink-0" />
                                EIN: {nonprofit.ein}
                              </>
                            )}
                          </div>
                          {nonprofit.category && (
                            <Badge variant="outline" className="text-xs h-5">
                              {nonprofit.category}
                            </Badge>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary
                                          flex items-center justify-center mt-0.5">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-border/50">
                <p className="text-muted-foreground text-sm">
                  No nonprofits found for "{searchQuery}". Try a different search term.
                </p>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed
                              border-border">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Type at least 2 characters to search nonprofits
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Selection summary ────────────────────────────────────────── */}
        {selectedCause && selectedNonprofit && (
          <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center
                              flex-shrink-0">
                <Heart className="w-6 h-6 text-primary fill-current" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-3 text-primary">Your Cause is Selected! 🎉</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Category
                    </p>
                    <p className="font-semibold">{selectedCause.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Nonprofit
                    </p>
                    <p className="font-semibold">{selectedNonprofit.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedNonprofit.city}, {selectedNonprofit.state}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => navigate('/products')} className="gap-2">
                    Shop Products <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/cart')} className="gap-2">
                    Go to Cart
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
