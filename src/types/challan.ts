/**
 * ORION Delivery Challan Types
 * 
 * Commercial Delivery Challan:
 * - Contains quantities and item rates (or zero/standard valuation).
 * - NO GST components (no CGST, SGST, IGST, tax rates).
 * - Linked to Stocks (deducts warehouse inventory on delivery).
 * - Included in Customer Ledger (tracks goods value delivered).
 * - Excluded from cash inflow/outflow.
 */
import type { CustomerSnapshot } from './customer'

export interface ChallanItem {
  id: string
  challanId: string
  productId: string | null
  description: string
  hsnCode?: string | null
  quantity: number        // stored multiplied by 100
  unit: string
  unitPrice: number       // in paise
  totalAmount: number     // in paise
  sortOrder: number
}

export interface Challan {
  id: string
  businessId: string
  challanNumber: string
  financialYear: string
  customerId: string | null
  customerSnapshot: CustomerSnapshot | null
  challanDate: string
  status: 'DELIVERED' | 'RETURNED' | 'CANCELLED'
  subtotal: number        // in paise
  totalAmount: number     // in paise
  notes?: string | null
  transportMode?: string | null
  vehicleNumber?: string | null
  transporterName?: string | null
  lrRrNumber?: string | null
  createdBy?: string | null
  isDeleted: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ChallanWithItems extends Challan {
  items: ChallanItem[]
}

export interface ChallanItemFormData {
  id: string
  productId: string
  description: string
  hsnCode: string
  quantity: string
  unit: string
  unitPrice: string
  totalAmount: number
}

export interface ChallanFormData {
  customerId: string
  customer?: any
  challanDate: string
  financialYear?: string
  challanNumber?: string
  transportMode?: string
  vehicleNumber?: string
  transporterName?: string
  lrRrNumber?: string
  notes?: string
  items: ChallanItemFormData[]
}

export interface ChallanListFilters {
  businessId: string
  financialYear?: string
  search?: string
  customerId?: string
  status?: string
  page?: number
  pageSize?: number
}
