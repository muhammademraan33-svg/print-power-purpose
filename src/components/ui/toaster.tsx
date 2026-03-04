import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toastListeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

function addToast(message: string, type: Toast['type'] = 'info') {
  const id = Math.random().toString(36).substring(7)
  toasts = [...toasts, { id, message, type }]
  toastListeners.forEach(listener => listener(toasts))
  
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    toastListeners.forEach(listener => listener(toasts))
  }, 5000)
}

export function toast(message: string, type: Toast['type'] = 'info') {
  addToast(message, type)
}

export function Toaster() {
  const [mounted, setMounted] = useState(false)
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([])

  useEffect(() => {
    setMounted(true)
    toastListeners.push(setCurrentToasts)
    return () => {
      toastListeners = toastListeners.filter(l => l !== setCurrentToasts)
    }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4">
      {currentToasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>,
    document.body
  )
}
