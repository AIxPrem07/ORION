import type { UUID, ISODateString, ISODateTimeString, Paise, BasisPoints, QuantityInt } from './common'
import type { CustomerSnapshot } from './customer'
import type { ProductSnapshot } from './product'

export type InvoiceStatus = 'DRAFT' | 'FINALIZED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'RETURNED'
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
export type SupplyType = 'INTRASTATE' | 'INTERSTATE'

export interface InvoiceSequence {
  id: UUID
  businessId: UUID
  prefix: string
  financialYear: string   // e.g. "26-27"
  currentNumber: number
  padding: number
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface InvoiceItem {
  id: UUID
  invoiceId: UUID
  productId: UUID | null
  productSnapshot: ProductSnapshot
  lineNumber: number
  description: string
  hsnCode: string | null
  quantity: QuantityInt          // stored as integer x 100
  unit: string | null
  purchasePrice: Paise
  unitPrice: Paise
  discountPercent: BasisPoints   // 100 = 1%
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

export interface Invoice {
  id: UUID
  businessId: UUID
  invoiceNumber: string
  customerId: UUID | null
  customerSnapshot: CustomerSnapshot
  invoiceDate: ISODateString
  dueDate: ISODateString | null
  status: InvoiceStatus
  paymentStatus: PaymentStatus
  supplyType: SupplyType
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
  termsAndConditions: string | null
  paymentMethod: string | null
  createdBy: UUID | null
  cancelledAt: ISODateTimeString | null
  cancelledReason: string | null
  // Shipping Address
  shippingName: string | null
  shippingAddress: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingStateCode: string | null
  shippingPin: string | null
  // Vehicle & Transport Details
  vehicleNumber: string | null
  transportMode: string | null
  transporterName: string | null
  transporterId: string | null
  lrRrNumber: string | null
  lrRrDate: string | null
  // Additional Charges
  shippingCharges: Paise
  additionalCharges: Paise
  additionalChargesLabel: string | null
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
}

/** Mutable form state for the invoice editor */
export interface InvoiceFormData {
  customerId: UUID | null
  customerSnapshot: CustomerSnapshot | null
  invoiceDate: ISODateString
  dueDate: ISODateString | null
  supplyType: SupplyType
  notes: string
  termsAndConditions: string
  paymentMethod: string
  // Shipping Address
  shippingName?: string
  shippingAddress?: string
  shippingCity?: string
  shippingState?: string
  shippingStateCode?: string
  shippingPin?: string
  // Transport Details
  vehicleNumber?: string
  transportMode?: string
  transporterName?: string
  transporterId?: string
  lrRrNumber?: string
  lrRrDate?: string
  // Additional Charges
  shippingCharges?: Paise
  additionalCharges?: Paise
  additionalChargesLabel?: string
  items: InvoiceItemFormData[]
}

export interface InvoiceItemFormData {
  id: string  // temp id for UI key
  productId: UUID | null
  productSnapshot: ProductSnapshot | null
  description: string
  hsnCode: string
  quantity: string   // displayed as decimal string
  unit: string
  unitPrice: string  // displayed as rupees string
  discountPercent: string
  taxRate: BasisPoints
  // Calculated (readonly in UI)
  discountAmount: Paise
  taxableAmount: Paise
  cgstRate: BasisPoints
  sgstRate: BasisPoints
  igstRate: BasisPoints
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  totalAmount: Paise
}

export interface InvoiceTotals {
  subtotal: Paise
  discountAmount: Paise
  taxableAmount: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  totalTax: Paise
  shippingCharges?: Paise
  overallDiscount?: Paise
  additionalCharges?: Paise
  additionalChargesLabel?: string
  roundOff: Paise
  totalAmount: Paise
}

