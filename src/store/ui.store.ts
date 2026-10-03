/**
 * ORION UI Store
 * Manages purely UI state: sidebar, modals, search overlay.
 */
import { create } from 'zustand'

type ModalType =
  | 'confirm'
  | 'customer-create'
  | 'supplier-create'
  | 'product-create'
  | 'payment-create'
  | 'stock-adjust'
  | 'invoice-cancel'
  | null

export interface ConfirmModal {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void | Promise<void>
}

interface UIState {
  sidebarCollapsed: boolean
  activeModal: ModalType
  confirmModal: ConfirmModal | null
  globalSearchOpen: boolean
  quickCreateOpen: boolean
  shortcutsModalOpen: boolean

  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  openModal: (modal: ModalType) => void
  closeModal: () => void
  openConfirm: (options: ConfirmModal) => void
  closeConfirm: () => void
  setGlobalSearchOpen: (open: boolean) => void
  setQuickCreateOpen: (open: boolean) => void
  setShortcutsModalOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeModal: null,
  confirmModal: null,
  globalSearchOpen: false,
  quickCreateOpen: false,
  shortcutsModalOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  openConfirm: (options) => set({ confirmModal: options }),
  closeConfirm: () => set({ confirmModal: null }),
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
  setQuickCreateOpen: (open) => set({ quickCreateOpen: open }),
  setShortcutsModalOpen: (open) => set({ shortcutsModalOpen: open }),
}))
