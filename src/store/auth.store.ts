/**
 * ORION Auth Store
 * Manages active user session, role permissions, and admin impersonation.
 */
import { create } from 'zustand'
import type { User } from '@/types/user'
import type { Business } from '@/types/business'
import { useBusinessStore } from './business.store'

const STORAGE_KEY = 'orion_auth_session_v1'

interface AuthState {
  user: User | null
  business: Business | null
  isAuthenticated: boolean
  isImpersonating: boolean
  originalAdminUser: User | null

  setSession: (user: User, business?: Business) => void
  clearSession: () => void
  startImpersonating: (targetBusiness: Business) => void
  stopImpersonating: () => void
  initFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  business: null,
  isAuthenticated: false,
  isImpersonating: false,
  originalAdminUser: null,

  setSession: (user, business) => {
    const sessionData = {
      user,
      business: business || null,
      savedAt: Date.now(),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
    } catch (e) {
      console.warn('[AuthStore] Failed to save session to localStorage:', e)
    }

    if (business) {
      useBusinessStore.getState().setBusiness(business)
    }

    set({
      user,
      business: business || null,
      isAuthenticated: true,
      isImpersonating: false,
      originalAdminUser: null,
    })
  },

  clearSession: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('[AuthStore] Failed to clear session from localStorage:', e)
    }
    useBusinessStore.getState().setBusiness(null)
    set({
      user: null,
      business: null,
      isAuthenticated: false,
      isImpersonating: false,
      originalAdminUser: null,
    })
  },

  startImpersonating: (targetBusiness) => {
    const current = get()
    if (current.user?.role !== 'admin') return

    useBusinessStore.getState().setBusiness(targetBusiness)
    set({
      originalAdminUser: current.user,
      business: targetBusiness,
      isImpersonating: true,
    })
  },

  stopImpersonating: () => {
    const current = get()
    if (!current.isImpersonating) return

    set({
      business: null,
      isImpersonating: false,
      originalAdminUser: null,
    })
  },

  initFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.user) {
        set({
          user: parsed.user,
          business: parsed.business || null,
          isAuthenticated: true,
        })
        if (parsed.business) {
          useBusinessStore.getState().setBusiness(parsed.business)
        }
      }
    } catch (e) {
      console.warn('[AuthStore] Failed to parse session from storage:', e)
    }
  },
}))
