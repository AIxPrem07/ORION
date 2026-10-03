/**
 * ORION Notification/Toast Store
 */
import { create } from 'zustand'
import { generateId } from '@utils/uuid'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number   // ms, 0 = persist
  createdAt: number
}

interface NotificationState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
  // Convenience methods
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = generateId()
    const newToast: Toast = { ...toast, id, createdAt: Date.now() }
    set((s) => ({ toasts: [...s.toasts, newToast] }))

    // Auto-remove after duration
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration)
    }
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),

  success: (title, message) => get().addToast({ type: 'success', title, message }),
  error: (title, message) => get().addToast({ type: 'error', title, message, duration: 6000 }),
  warning: (title, message) => get().addToast({ type: 'warning', title, message }),
  info: (title, message) => get().addToast({ type: 'info', title, message }),
}))
