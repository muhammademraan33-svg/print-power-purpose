import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, Menu, X, Printer, Heart } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const navLinks = [
  { to: '/products', label: 'Products' },
  { to: '/causes',   label: 'Give Back' },
]

export default function Navbar() {
  const { getItemCount } = useCart()
  const itemCount = getItemCount()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-border/50'
          : 'bg-white border-b border-border/30'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* ── Logo ─────────────────────────────────────────────────────── */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group flex-shrink-0"
            aria-label="Print Power Purpose — Home"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm
                            group-hover:shadow-md transition-shadow">
              <Printer className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-base font-bold text-foreground tracking-tight">
                Print<span className="text-primary"> Power</span>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">
                Purpose
              </span>
            </div>
            <span className="sm:hidden text-base font-bold text-primary">PPP</span>
          </Link>

          {/* ── Desktop Nav ───────────────────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive(to)
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground/80 hover:text-foreground hover:bg-muted'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* ── Right actions ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-2">
            {/* Cause badge (desktop) */}
            <Link
              to="/causes"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full
                         bg-primary/8 hover:bg-primary/15 border border-primary/20
                         text-primary text-xs font-semibold transition-all"
            >
              <Heart className="w-3.5 h-3.5" />
              Give Back
            </Link>

            {/* Cart */}
            <Link to="/cart" aria-label={`Cart (${itemCount} items)`}>
              <Button
                variant="ghost"
                size="icon"
                className="relative w-10 h-10 rounded-xl hover:bg-muted"
              >
                <ShoppingCart className="h-5 w-5 text-foreground/80" />
                {itemCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center
                               justify-center p-0 px-1 text-[10px] font-bold bg-primary
                               text-primary-foreground border-2 border-white"
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden w-10 h-10 rounded-xl hover:bg-muted"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ────────────────────────────────────────────────────── */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="bg-white border-t border-border/50 px-4 py-3 space-y-1 shadow-lg">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive(to)
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-foreground/80 hover:bg-muted'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border/40">
            <Link
              to="/cart"
              className="flex items-center justify-between px-4 py-3 rounded-xl text-sm
                         font-medium text-foreground/80 hover:bg-muted transition-all"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Shopping Cart
              </span>
              {itemCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  {itemCount}
                </Badge>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
