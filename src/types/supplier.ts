import type { UUID, ISODateTimeString, Paise, StateCode } from './common'

export interface Supplier {
  id: UUID
  businessId: UUID
  supplierCode: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  stateCode: StateCode | null
  pin: string | null
  gstin: string | null
  pan: string | null
  openingBalance: Paise   // positive = payable to supplier
  paymentTerms: number    // days
  notes: string | null
  isActive: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export type SupplierFormData = Omit<Supplier, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'isActive'> & {
  isActive?: boolean
}

export interface SupplierSummary {
  supplierId: UUID
  supplierName: string
  totalPurchased: Paise
  totalPaid: Paise
  outstanding: Paise
  purchaseCount: number
  lastPurchaseDate: string | null
}

export interface SupplierSnapshot {
  id: UUID
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  stateCode: StateCode | null
  pin: string | null
  gstin: string | null
}
