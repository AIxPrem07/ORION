import type { UUID, ISODateString, ISODateTimeString, Paise } from './common'

export type PaymentType = 'RECEIPT' | 'PAYMENT'
export type PartyType = 'CUSTOMER' | 'SUPPLIER'
export type PaymentMethod = 'CASH' | 'BANK' | 'UPI' | 'CARD' | 'CHEQUE' | 'OTHER'
export type PaymentRecordStatus = 'COMPLETED' | 'CANCELLED' | 'PENDING'

export interface Payment {
  id: UUID
  businessId: UUID
  paymentType: PaymentType
  partyType: PartyType
  partyId: UUID
  paymentDate: ISODateString
  amount: Paise
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  status: PaymentRecordStatus
  createdBy: UUID | null
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface PaymentAllocation {
  id: UUID
  paymentId: UUID
  invoiceId: UUID | null
  purchaseId: UUID | null
  amount: Paise
  createdAt: ISODateTimeString
}

export interface PaymentWithAllocations extends Payment {
  allocations: PaymentAllocation[]
  partyName: string
}

export interface PaymentFormData {
  paymentType: PaymentType
  partyType: PartyType
  partyId: UUID
  paymentDate: ISODateString
  amount: string  // rupees as string
  method: PaymentMethod
  referenceNumber: string
  notes: string
  allocations: {
    invoiceId?: UUID
    purchaseId?: UUID
    amount: string
  }[]
}
