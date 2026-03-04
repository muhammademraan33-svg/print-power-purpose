import React, { createContext, useContext, useState, useEffect } from 'react'
import type { Cause, Nonprofit } from '../types'

interface CauseContextType {
  selectedCause: Cause | null
  selectedNonprofit: Nonprofit | null
  setSelectedCause: (cause: Cause | null) => void
  setSelectedNonprofit: (nonprofit: Nonprofit | null) => void
  clearSelection: () => void
}

const CauseContext = createContext<CauseContextType | undefined>(undefined)

const CAUSE_STORAGE_KEY = 'print-power-purpose-cause'
const NONPROFIT_STORAGE_KEY = 'print-power-purpose-nonprofit'

export function CauseProvider({ children }: { children: React.ReactNode }) {
  const [selectedCause, setSelectedCauseState] = useState<Cause | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CAUSE_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    }
    return null
  })

  const [selectedNonprofit, setSelectedNonprofitState] = useState<Nonprofit | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(NONPROFIT_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    }
    return null
  })

  useEffect(() => {
    if (selectedCause) {
      localStorage.setItem(CAUSE_STORAGE_KEY, JSON.stringify(selectedCause))
    } else {
      localStorage.removeItem(CAUSE_STORAGE_KEY)
    }
  }, [selectedCause])

  useEffect(() => {
    if (selectedNonprofit) {
      localStorage.setItem(NONPROFIT_STORAGE_KEY, JSON.stringify(selectedNonprofit))
    } else {
      localStorage.removeItem(NONPROFIT_STORAGE_KEY)
    }
  }, [selectedNonprofit])

  const setSelectedCause = (cause: Cause | null) => {
    setSelectedCauseState(cause)
  }

  const setSelectedNonprofit = (nonprofit: Nonprofit | null) => {
    setSelectedNonprofitState(nonprofit)
  }

  const clearSelection = () => {
    setSelectedCauseState(null)
    setSelectedNonprofitState(null)
  }

  return (
    <CauseContext.Provider
      value={{
        selectedCause,
        selectedNonprofit,
        setSelectedCause,
        setSelectedNonprofit,
        clearSelection,
      }}
    >
      {children}
    </CauseContext.Provider>
  )
}

export function useCause() {
  const context = useContext(CauseContext)
  if (context === undefined) {
    throw new Error('useCause must be used within a CauseProvider')
  }
  return context
}
