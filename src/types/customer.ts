import type { UUID, ISODateTimeString, Paise, StateCode } from './common'

export interface Customer {
  id: UUID
  businessId: UUID
  customerCode: string | null
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
  openingBalance: Paise   // positive = receivable from customer
  creditLimit: Paise
  paymentTerms: number    // days
  notes: string | null
  isActive: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export type CustomerFormData = Omit<Customer, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'isActive'> & {
  isActive?: boolean
}

export interface CustomerSummary {
  customerId: UUID
  customerName: string
  totalInvoiced: Paise
  totalPaid: Paise
  outstanding: Paise
  invoiceCount: number
  lastInvoiceDate: string | null
}

/** Snapshot of customer data embedded in invoice at time of creation */
export interface CustomerSnapshot {
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
  pan: string | null
}
