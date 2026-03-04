import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function calculateDonation(totalCents: number): number {
  // $10 for every $50 spent
  return Math.floor(totalCents / 5000) * 1000
}

export function getDonationProgress(totalCents: number): {
  currentDonation: number
  nextThreshold: number
  amountNeeded: number
} {
  const currentDonation = calculateDonation(totalCents)
  const nextThreshold = Math.ceil(totalCents / 5000) * 5000
  const amountNeeded = nextThreshold - totalCents

  return {
    currentDonation,
    nextThreshold,
    amountNeeded: amountNeeded > 0 ? amountNeeded : 0,
  }
}

export function generateOrderNumber(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${timestamp}-${random}`
}
