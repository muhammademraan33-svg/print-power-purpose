import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CartProvider } from './contexts/CartContext'
import { CauseProvider } from './contexts/CauseContext'
import { Toaster } from './components/ui/toaster'

// Pages
import Index from './pages/Index'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Causes from './pages/Causes'
import Success from './pages/Success'
import NotFound from './pages/NotFound'
import ImageSync from './pages/admin/ImageSync'

// Layout
import Layout from './components/layout/Layout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <CauseProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/causes" element={<Causes />} />
                <Route path="/success" element={<Success />} />
                <Route path="/admin/image-sync" element={<ImageSync />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
            <Toaster />
          </BrowserRouter>
        </CauseProvider>
      </CartProvider>
    </QueryClientProvider>
  )
}

export default App
