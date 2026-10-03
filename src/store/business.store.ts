/**
 * ORION Business Store
 * Caches the active business profile in memory.
 */
import { create } from 'zustand'
import type { Business } from '@/types/business'

interface BusinessState {
  business: Business | null
  isLoading: boolean
  isSetupComplete: boolean

  setBusiness: (b: Business | null) => void
  setLoading: (v: boolean) => void
  setSetupComplete: (v: boolean) => void
}

export const useBusinessStore = create<BusinessState>((set) => ({
  business: null,
  isLoading: true,
  isSetupComplete: false,

  setBusiness: (b) => set({ business: b }),
  setLoading: (v) => set({ isLoading: v }),
  setSetupComplete: (v) => set({ isSetupComplete: v }),
}))
