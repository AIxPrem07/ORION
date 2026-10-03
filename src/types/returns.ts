import type { UUID, ISODateString, ISODateTimeString, Paise } from './common'

export type ReturnType = 'SALE_RETURN' | 'PURCHASE_RETURN'
export type ReturnStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
export type NoteStatus = 'ISSUED' | 'APPLIED' | 'CANCELLED'

export interface ReturnItem {
  id: UUID
  returnId: UUID
  productId: UUID
  productName?: string
  productCode?: string
  quantity: number // scaled x100 (e.g., 100 = 1 unit)
  unitPrice: Paise // in paise
  totalAmount: Paise // in paise
  createdAt: ISODateTimeString
}

export interface Return {
  id: UUID
  businessId: UUID
  returnType: ReturnType
  returnNumber: string
  originalInvoiceId?: UUID | null
  originalPurchaseId?: UUID | null
  partyId: UUID
  partyName?: string
  returnDate: ISODateString
  status: ReturnStatus
  totalAmount: Paise
  notes?: string | null
  createdBy?: UUID | null
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
  items?: ReturnItem[]
  creditNoteId?: UUID | null
  creditNoteNumber?: string | null
  debitNoteId?: UUID | null
  debitNoteNumber?: string | null
}

export interface CreditNote {
  id: UUID
  businessId: UUID
  creditNoteNumber: string
  customerId: UUID
  customerName?: string
  returnId?: UUID | null
  invoiceId?: UUID | null
  invoiceNumber?: string | null
  issueDate: ISODateString
  amount: Paise
  reason?: string | null
  status: NoteStatus
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface DebitNote {
  id: UUID
  businessId: UUID
  debitNoteNumber: string
  supplierId: UUID
  supplierName?: string
  returnId?: UUID | null
  purchaseId?: UUID | null
  purchaseNumber?: string | null
  issueDate: ISODateString
  amount: Paise
  reason?: string | null
  status: NoteStatus
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface ReturnItemInput {
  productId: UUID
  quantity: number // scaled x100
  unitPrice: Paise
}

export interface CreateSalesReturnInput {
  businessId: UUID
  customerId: UUID
  originalInvoiceId?: UUID | null
  returnDate: ISODateString
  items: ReturnItemInput[]
  reason?: string
  notes?: string
}

export interface CreatePurchaseReturnInput {
  businessId: UUID
  supplierId: UUID
  originalPurchaseId?: UUID | null
  returnDate: ISODateString
  items: ReturnItemInput[]
  reason?: string
  notes?: string
}
