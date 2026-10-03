import type { UUID, ISODateString, ISODateTimeString, Paise, BasisPoints, QuantityInt } from './common'
import type { SupplierSnapshot } from './supplier'
import type { ProductSnapshot } from './product'

export type PurchaseStatus = 'DRAFT' | 'FINALIZED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED'
export type PurchasePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'

export interface PurchaseItem {
  id: UUID
  purchaseId: UUID
  productId: UUID | null
  productSnapshot: ProductSnapshot
  lineNumber: number
  description: string
  hsnCode: string | null
  quantity: QuantityInt
  unit: string | null
  unitPrice: Paise
  discountPercent: BasisPoints
  discountAmount: Paise
  taxableAmount: Paise
  taxRate: BasisPoints
  cgstRate: BasisPoints
  sgstRate: BasisPoints
  igstRate: BasisPoints
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  totalAmount: Paise
  createdAt: ISODateTimeString
}

export interface Purchase {
  id: UUID
  businessId: UUID
  purchaseNumber: string | null
  supplierId: UUID | null
  supplierSnapshot: SupplierSnapshot
  purchaseDate: ISODateString
  dueDate: ISODateString | null
  status: PurchaseStatus
  paymentStatus: PurchasePaymentStatus
  supplyType: 'INTRASTATE' | 'INTERSTATE'
  subtotal: Paise
  discountAmount: Paise
  taxableAmount: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  totalTax: Paise
  roundOff: Paise
  totalAmount: Paise
  paidAmount: Paise
  notes: string | null
  createdBy: UUID | null
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[]
}
