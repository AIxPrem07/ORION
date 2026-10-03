import type { UUID, ISODateTimeString } from './common'

export type StockMovementType = 'OPENING' | 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT' | 'DAMAGE'
export type StockReferenceType = 'INVOICE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT'

export interface StockMovement {
  id: UUID
  businessId: UUID
  productId: UUID
  movementType: StockMovementType
  referenceType: StockReferenceType | null
  referenceId: UUID | null
  quantity: number   // positive = in, negative = out (actual quantity, not x100)
  quantityBefore: number
  quantityAfter: number
  notes: string | null
  createdBy: UUID | null
  createdAt: ISODateTimeString
}

export interface StockAdjustmentFormData {
  productId: UUID
  adjustedQuantity: number  // the new target stock level
  notes: string
}

export interface CurrentStock {
  productId: UUID
  productName: string
  productCode: string | null
  unitAbbreviation: string | null
  minimumStock: number
  currentStock: number
  isLowStock: boolean
}

export interface ManualStockEntryInput {
  businessId: string
  productId: string
  mode: 'ADD' | 'DEDUCT' | 'SET'
  quantity: number
  movementType?: StockMovementType
  customDateTime?: string
  notes?: string
  createdBy?: string
}

export interface MonthlyProductStockSummary {
  productId: string
  productName: string
  productCode: string | null
  unitAbbreviation: string | null
  minimumStock: number
  openingStock: number
  inwardStock: number
  outwardStock: number
  closingStock: number
  isLowStock: boolean
}

export interface MonthlyStockMovementDetail {
  id: string
  createdAt: string
  productId: string
  productName: string
  productCode: string | null
  unitAbbreviation: string | null
  movementType: string
  quantity: number
  quantityBefore: number
  quantityAfter: number
  notes: string | null
}

export interface MonthlyInventoryReportData {
  year: number
  month: number
  monthName: string
  startDate: string
  endDate: string
  products: MonthlyProductStockSummary[]
  movements: MonthlyStockMovementDetail[]
  totalOpeningStock: number
  totalInwardStock: number
  totalOutwardStock: number
  totalClosingStock: number
}
