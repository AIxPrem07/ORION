/**
 * ORION Invoice Draft Store
 * Holds the in-progress invoice being created/edited.
 * This is ephemeral UI state, not persisted to DB until saved.
 */
import { create } from 'zustand'
import { todayISO } from '@utils/date'
import type { InvoiceItemFormData } from '@/types/invoice'
import type { CustomerSnapshot } from '@/types/customer'

interface InvoiceDraftState {
  invoiceId: string | null    // null = new invoice, UUID = editing existing draft
  customerId: string | null
  customerSnapshot: CustomerSnapshot | null
  invoiceDate: string
  dueDate: string | null
  supplyType: 'INTRASTATE' | 'INTERSTATE'
  notes: string
  termsAndConditions: string
  paymentMethod: string
  items: InvoiceItemFormData[]
  isDirty: boolean

  // Actions
  setCustomer: (id: string | null, snapshot: CustomerSnapshot | null) => void
  setInvoiceDate: (date: string) => void
  setDueDate: (date: string | null) => void
  setSupplyType: (type: 'INTRASTATE' | 'INTERSTATE') => void
  setNotes: (notes: string) => void
  setTerms: (terms: string) => void
  setPaymentMethod: (method: string) => void
  addItem: (item: InvoiceItemFormData) => void
  updateItem: (index: number, item: Partial<InvoiceItemFormData>) => void
  removeItem: (index: number) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  reset: () => void
  loadDraft: (invoiceId: string, data: Partial<InvoiceDraftState>) => void
}

const INITIAL_STATE = {
  invoiceId: null,
  customerId: null,
  customerSnapshot: null,
  invoiceDate: todayISO(),
  dueDate: null,
  supplyType: 'INTRASTATE' as const,
  notes: '',
  termsAndConditions: '',
  paymentMethod: '',
  items: [],
  isDirty: false,
}

export const useInvoiceDraftStore = create<InvoiceDraftState>((set, get) => ({
  ...INITIAL_STATE,

  setCustomer: (id, snapshot) => set({ customerId: id, customerSnapshot: snapshot, isDirty: true }),
  setInvoiceDate: (date) => set({ invoiceDate: date, isDirty: true }),
  setDueDate: (date) => set({ dueDate: date, isDirty: true }),
  setSupplyType: (type) => set({ supplyType: type, isDirty: true }),
  setNotes: (notes) => set({ notes, isDirty: true }),
  setTerms: (terms) => set({ termsAndConditions: terms, isDirty: true }),
  setPaymentMethod: (method) => set({ paymentMethod: method, isDirty: true }),

  addItem: (item) => set((s) => ({ items: [...s.items, item], isDirty: true })),

  updateItem: (index, item) =>
    set((s) => ({
      items: s.items.map((existing, i) => (i === index ? { ...existing, ...item } : existing)),
      isDirty: true,
    })),

  removeItem: (index) =>
    set((s) => ({ items: s.items.filter((_, i) => i !== index), isDirty: true })),

  reorderItems: (fromIndex, toIndex) =>
    set((s) => {
      const items = [...s.items]
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { items, isDirty: true }
    }),

  reset: () => set({ ...INITIAL_STATE, invoiceDate: todayISO() }),

  loadDraft: (invoiceId, data) =>
    set({ ...INITIAL_STATE, ...data, invoiceId, isDirty: false }),
}))
