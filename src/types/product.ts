import type { UUID, ISODateTimeString, Paise, BasisPoints } from './common'

export interface ProductCategory {
  id: UUID
  businessId: UUID
  name: string
  description: string | null
  parentId: UUID | null
  isActive: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface Unit {
  id: UUID
  businessId: UUID
  name: string
  abbreviation: string
  isActive: boolean
  createdAt: ISODateTimeString
}

export interface TaxRate {
  id: UUID
  businessId: UUID
  name: string
  rate: BasisPoints   // e.g. 1800 = 18%
  hsnCode: string | null
  isActive: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export interface Product {
  id: UUID
  businessId: UUID
  productCode: string | null
  sku: string | null
  barcode: string | null
  name: string
  description: string | null
  categoryId: UUID | null
  brand: string | null
  unitId: UUID | null
  purchasePrice: Paise
  sellingPrice: Paise
  mrp: Paise
  taxRateId: UUID | null
  hsnCode: string | null
  openingStock: number    // quantity
  minimumStock: number
  defaultSupplierId: UUID | null
  isActive: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export type ProductFormData = Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'isActive' | 'categoryId' | 'defaultSupplierId'> & {
  isActive?: boolean
  categoryId?: UUID | null
  defaultSupplierId?: UUID | null
}

/** Product with resolved joins */
export interface ProductWithDetails extends Product {
  categoryName: string | null
  unitAbbreviation: string | null
  taxRateName: string | null
  taxRatePercent: number | null
  currentStock: number
  isLowStock?: boolean
}

/** Snapshot of product data embedded in invoice/purchase line items */
export interface ProductSnapshot {
  id: UUID
  name: string
  productCode: string | null
  hsnCode: string | null
  unitAbbreviation: string | null
  taxRate: BasisPoints
}
