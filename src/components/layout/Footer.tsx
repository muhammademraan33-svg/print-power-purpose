import { Link } from 'react-router-dom'
import { Printer, Heart, Mail, Phone, MapPin, Shield, Truck, Star, Award } from 'lucide-react'

const quickLinks = [
  { to: '/products', label: 'All Products' },
  { to: '/products?category=Business+Cards', label: 'Business Cards' },
  { to: '/products?category=Flyers', label: 'Flyers & Leaflets' },
  { to: '/products?category=Banners', label: 'Banners & Signs' },
  { to: '/products?category=Apparel', label: 'Custom Apparel' },
]

const causeLinks = [
  { to: '/causes', label: 'Choose a Cause' },
  { to: '/causes', label: 'Nonprofit Directory' },
  { to: '/causes', label: 'Impact Reports' },
  { to: '/causes', label: 'Partner with Us' },
]

const trustBadges = [
  { icon: Shield,  label: 'Secure Payments' },
  { icon: Truck,   label: 'Fast Shipping' },
  { icon: Star,    label: 'Top Rated' },
  { icon: Award,   label: 'Verified Print Shop' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-foreground text-background">
      {/* Trust strip */}
      <div className="border-b border-white/10 py-5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-6">
            {trustBadges.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-white/70">
                <Icon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main footer content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 group mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/80 flex items-center justify-center">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-bold text-white tracking-tight">
                  Print<span className="text-yellow-400"> Power</span>
                </span>
                <span className="text-[10px] font-medium text-white/50 tracking-widest uppercase">
                  Purpose
                </span>
              </div>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              Professional print shop with a mission. We donate{' '}
              <span className="text-yellow-400 font-semibold">$10 for every $50</span> you spend
              to the nonprofit of your choice.
            </p>
            <div className="flex items-center gap-2 text-yellow-400">
              <Heart className="w-4 h-4 fill-current" />
              <span className="text-sm font-semibold">Powered by Purpose</span>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">
              Products
            </h4>
            <ul className="space-y-3">
              {quickLinks.map(({ to, label }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-sm text-white/60 hover:text-white transition-colors animated-underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Give Back */}
          <div>
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">
              Give Back
            </h4>
            <ul className="space-y-3">
              {causeLinks.map(({ to, label }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-sm text-white/60 hover:text-white transition-colors animated-underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">
              Contact Us
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-white/60">
                <Mail className="w-4 h-4 mt-0.5 text-white/40 flex-shrink-0" />
                <a
                  href="mailto:support@printpowerpurpose.com"
                  className="hover:text-white transition-colors break-all"
                >
                  support@printpowerpurpose.com
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm text-white/60">
                <Phone className="w-4 h-4 mt-0.5 text-white/40 flex-shrink-0" />
                <span>1-800-PRINT-PPP</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-white/60">
                <MapPin className="w-4 h-4 mt-0.5 text-white/40 flex-shrink-0" />
                <span>United States</span>
              </li>
            </ul>

            {/* Payment methods */}
            <div className="mt-6">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
                Secure Checkout
              </p>
              <div className="flex gap-2 flex-wrap">
                {['Visa', 'MC', 'Amex', 'Stripe'].map((m) => (
                  <span
                    key={m}
                    className="px-2 py-1 bg-white/10 rounded text-xs text-white/60 border border-white/10"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <p>© {year} Print Power Purpose. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="hover:text-white/70 cursor-pointer transition-colors">Privacy Policy</span>
              <span className="text-white/20">|</span>
              <span className="hover:text-white/70 cursor-pointer transition-colors">Terms of Service</span>
              <span className="text-white/20">|</span>
              <span className="hover:text-white/70 cursor-pointer transition-colors">Refund Policy</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
