import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  ShoppingBag, Heart, TrendingUp, Star, ArrowRight, Printer,
  CheckCircle, Truck, Shield, Sparkles, ChevronRight,
} from 'lucide-react'

// ── Static data ──────────────────────────────────────────────────────────────
const howItWorks = [
  {
    step: '01',
    icon: ShoppingBag,
    title: 'Shop Products',
    desc: 'Browse business cards, flyers, banners, custom apparel, and more. Customize your design with our built-in designer.',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    step: '02',
    icon: Heart,
    title: 'Choose a Cause',
    desc: 'Select from over 1.2 million verified nonprofits. Your donation goes 100% directly to the organization you choose.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    step: '03',
    icon: TrendingUp,
    title: 'Make an Impact',
    desc: 'We automatically donate $10 for every $50 you spend. No extra steps — your printing order changes lives.',
    color: 'bg-amber-50 text-amber-600',
  },
]

const categories = [
  {
    name: 'Business Cards',
    image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
    count: 'From $19',
  },
  {
    name: 'Flyers',
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&q=80',
    count: 'From $29',
  },
  {
    name: 'Banners',
    image: 'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=400&q=80',
    count: 'From $39',
  },
  {
    name: 'Apparel',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
    count: 'From $24',
  },
]

const stats = [
  { value: '$10', label: 'Donated per $50 spent', sub: 'automatic' },
  { value: '1.2M+', label: 'Verified Nonprofits', sub: 'to choose from' },
  { value: '300+', label: 'Print Products', sub: 'available' },
  { value: '100%', label: 'Donation goes to cause', sub: 'no middleman' },
]

const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Small Business Owner',
    text: 'I needed business cards and wanted to support my local animal shelter. Print Power Purpose made it so easy to do both at once!',
    rating: 5,
  },
  {
    name: 'James T.',
    role: 'Nonprofit Director',
    text: 'Our organization has received donations from customers using Print Power Purpose. It\'s a brilliant model.',
    rating: 5,
  },
  {
    name: 'Emily R.',
    role: 'Event Planner',
    text: 'The print quality is excellent and I love knowing my flyer order helped feed families in need. Will order again!',
    rating: 5,
  },
]

const trustPoints = [
  { icon: Shield, text: 'SSL Secure Checkout' },
  { icon: Truck,  text: 'Fast Nationwide Shipping' },
  { icon: CheckCircle, text: 'Quality Guaranteed' },
  { icon: Printer, text: 'Professional Print Quality' },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function Index() {
  return (
    <div className="overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[88vh] flex items-center hero-pattern overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/6 rounded-full
                          blur-3xl translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-400/8 rounded-full
                          blur-3xl -translate-x-1/3 translate-y-1/3" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: Copy */}
            <div className="max-w-xl">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10
                              border border-primary/20 mb-8">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary text-xs font-bold uppercase tracking-wider">
                  Print with Purpose
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.05]
                             tracking-tight text-foreground">
                Print that{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 gradient-text">gives back</span>
                  <svg
                    className="absolute -bottom-1 left-0 w-full"
                    viewBox="0 0 300 8"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2 6 Q75 1 150 5 Q225 9 298 3"
                      stroke="hsl(42,85%,55%)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
                High-quality printing for your business — and{' '}
                <strong className="text-foreground font-semibold">
                  $10 donated for every $50
                </strong>{' '}
                you spend to the nonprofit of your choice. Zero extra steps.
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                <Link to="/products">
                  <Button size="lg" className="gap-2 text-base px-8 h-13 shadow-lg shadow-primary/25
                                               hover:shadow-primary/40 hover:-translate-y-0.5 transition-all">
                    Shop Products
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/causes">
                  <Button size="lg" variant="outline"
                    className="gap-2 text-base px-8 h-13 border-2 hover:bg-primary/5 hover:border-primary">
                    <Heart className="w-4 h-4" />
                    Choose a Cause
                  </Button>
                </Link>
              </div>

              {/* Trust row */}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {trustPoints.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visual grid */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="img-zoom rounded-2xl overflow-hidden aspect-[3/4] shadow-xl">
                    <img
                      src="https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500&q=80"
                      alt="Business cards"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="img-zoom rounded-2xl overflow-hidden aspect-square shadow-lg">
                    <img
                      src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80"
                      alt="Custom apparel"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  <div className="img-zoom rounded-2xl overflow-hidden aspect-square shadow-lg">
                    <img
                      src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=500&q=80"
                      alt="Flyers"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="img-zoom rounded-2xl overflow-hidden aspect-[3/4] shadow-xl">
                    <img
                      src="https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=500&q=80"
                      alt="Print products"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Floating donation badge */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 bg-white rounded-2xl
                              shadow-2xl p-4 border border-border/50 min-w-[160px]">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4 text-rose-500 fill-current" />
                  <span className="text-xs font-semibold text-muted-foreground">Auto Donation</span>
                </div>
                <p className="text-2xl font-extrabold text-primary">$10</p>
                <p className="text-xs text-muted-foreground">per $50 spent</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-primary py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {stats.map(({ value, label, sub }) => (
              <div key={label} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-white mb-1">{value}</p>
                <p className="text-sm font-semibold text-white/90">{label}</p>
                <p className="text-xs text-white/60 capitalize">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="section-pad grid-bg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">
              Simple Process
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three simple steps — order your print, support a cause, and make an impact.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 max-w-5xl mx-auto">
            {howItWorks.map(({ step, icon: Icon, title, desc, color }, i) => (
              <div key={title} className="relative">
                {/* Connector line (desktop) */}
                {i < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-px
                                  bg-gradient-to-r from-border to-transparent z-0 -translate-y-1/2" />
                )}
                <div className="relative z-10 bg-white rounded-2xl border border-border/50 p-8
                                shadow-sm hover:shadow-lg transition-shadow group">
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center
                                    group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="text-5xl font-black text-muted/40 leading-none">{step}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CATEGORY TILES
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="section-pad bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-2">
                Shop by Category
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Popular Products
              </h2>
            </div>
            <Link
              to="/products"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold
                         text-primary hover:gap-3 transition-all"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {categories.map(({ name, image, count }) => (
              <Link key={name} to="/products">
                <div className="relative group rounded-2xl overflow-hidden aspect-[4/5] bg-muted
                                shadow-sm hover:shadow-xl transition-all duration-300
                                hover:-translate-y-1">
                  <img
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500
                               group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20
                                  to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-white font-bold text-lg leading-tight">{name}</h3>
                    <p className="text-white/70 text-sm mt-0.5">{count}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-8 sm:hidden">
            <Link to="/products">
              <Button variant="outline" className="gap-2">
                View All Products <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          GIVE BACK HIGHLIGHT
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="section-pad">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-primary px-8 py-16 md:px-16">
            {/* bg blobs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full
                            translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full
                            -translate-x-1/2 translate-y-1/2 pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                              bg-white/15 mb-6">
                <Heart className="w-8 h-8 text-white fill-current" />
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5 tracking-tight">
                Together, We're Making <br className="hidden md:block" />
                a Difference
              </h2>
              <p className="text-white/80 text-lg mb-8 leading-relaxed">
                Every order automatically triggers a donation to the nonprofit of your choice.
                No extra cost to you — just better printing that gives back.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/causes">
                  <Button size="lg"
                    className="bg-white text-primary hover:bg-white/90 font-bold gap-2
                               shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    <Heart className="w-4 h-4" />
                    Choose Your Cause
                  </Button>
                </Link>
                <Link to="/products">
                  <Button size="lg" variant="ghost"
                    className="text-white border-2 border-white/30 hover:bg-white/10 font-semibold gap-2">
                    Start Shopping <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="section-pad bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-2">
              Customer Stories
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, text, rating }) => (
              <div key={name}
                className="bg-white rounded-2xl p-7 border border-border/50 shadow-sm
                           hover:shadow-md transition-shadow">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-foreground/80 text-sm leading-relaxed mb-5">"{text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">{name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM CTA
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="section-pad">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">
            Ready to Start?
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
            Print Something Great Today
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            High-quality prints delivered fast — and every order funds a cause you care about.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/products">
              <Button size="lg" className="gap-2 text-base px-10 shadow-lg shadow-primary/25">
                Browse All Products <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/causes">
              <Button size="lg" variant="outline" className="gap-2 text-base px-10 border-2">
                <Heart className="w-4 h-4" />
                Explore Causes
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
