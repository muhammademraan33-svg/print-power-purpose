import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { CartItem } from '../types'

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'cartItemId'>) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'print-power-purpose-cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    }
    return []
  })

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = useCallback((item: Omit<CartItem, 'cartItemId'>) => {
    setItems((prev) => {
      // Generate unique cart item ID
      const cartItemId = `${item.productId}-${JSON.stringify(item.configuration || {})}-${Date.now()}`
      const newItem: CartItem = { ...item, cartItemId }
      
      // Check if same product with same configuration exists
      const existingIndex = prev.findIndex(
        (i) => i.productId === item.productId && 
               JSON.stringify(i.configuration) === JSON.stringify(item.configuration)
      )

      if (existingIndex >= 0) {
        // Update quantity
        const updated = [...prev]
        updated[existingIndex].quantity += item.quantity
        return updated
      }

      return [...prev, newItem]
    })
  }, [])

  const removeItem = useCallback((cartItemId: string) => {
    setItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId))
  }, [])

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId)
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      )
    )
  }, [removeItem])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const getTotal = useCallback(() => {
    return items.reduce((total, item) => {
      // For job-priced items (e.g. SinaLite), trust the stored job total instead of unit * qty
      if (item.jobTotalCents != null && item.jobTotalCents > 0) {
        return total + item.jobTotalCents
      }
      return total + item.priceCents * item.quantity
    }, 0)
  }, [items])

  const getItemCount = useCallback(() => {
    return items.reduce((count, item) => count + item.quantity, 0)
  }, [items])

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
