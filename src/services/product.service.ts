/**
 * ORION Product Service
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { recordAuditEvent } from './audit.service'
import { setOpeningStock } from './inventory.service'
import type { Product, ProductFormData, ProductCategory, Unit, TaxRate, ProductWithDetails } from '@/types/product'

function rowToProduct(r: Record<string, unknown>): Product {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    productCode: r.product_code as string | null,
    sku: r.sku as string | null,
    barcode: r.barcode as string | null,
    name: r.name as string,
    description: r.description as string | null,
    categoryId: r.category_id as string | null,
    brand: r.brand as string | null,
    unitId: r.unit_id as string | null,
    purchasePrice: r.purchase_price as number,
    sellingPrice: r.selling_price as number,
    mrp: r.mrp as number,
    taxRateId: r.tax_rate_id as string | null,
    hsnCode: r.hsn_code as string | null,
    openingStock: r.opening_stock as number,
    minimumStock: r.minimum_stock as number,
    defaultSupplierId: r.default_supplier_id as string | null,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export async function createProduct(
  businessId: string,
  data: ProductFormData,
): Promise<Product> {
  const id = generateId()
  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO products (id, business_id, product_code, sku, barcode, name, description, category_id, brand, unit_id, purchase_price, selling_price, mrp, tax_rate_id, hsn_code, opening_stock, minimum_stock, default_supplier_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, businessId, data.productCode, data.sku, data.barcode, data.name, data.description, data.categoryId, data.brand, data.unitId, data.purchasePrice, data.sellingPrice, data.mrp, data.taxRateId, data.hsnCode, data.openingStock, data.minimumStock, data.defaultSupplierId, now, now],
    )
  })

  // Record opening stock as a stock movement
  if (data.openingStock > 0) {
    await setOpeningStock({ businessId, productId: id, quantity: data.openingStock })
  }

  await recordAuditEvent({ businessId, action: 'CREATED', entityType: 'PRODUCT', entityId: id, newValues: { name: data.name } })

  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM products WHERE id = ?`, [id])
  return rowToProduct(rows[0])
}

export async function updateProduct(id: string, businessId: string, data: Partial<ProductFormData>): Promise<Product> {
  const now = nowISO()
  const fieldMap: Record<string, string> = {
    productCode: 'product_code', sku: 'sku', barcode: 'barcode', name: 'name', description: 'description',
    categoryId: 'category_id', brand: 'brand', unitId: 'unit_id', purchasePrice: 'purchase_price',
    sellingPrice: 'selling_price', mrp: 'mrp', taxRateId: 'tax_rate_id', hsnCode: 'hsn_code',
    minimumStock: 'minimum_stock', defaultSupplierId: 'default_supplier_id', isActive: 'is_active',
  }
  const setClauses: string[] = []
  const params: unknown[] = []
  for (const [jsKey, sqlKey] of Object.entries(fieldMap)) {
    if (jsKey in data) { setClauses.push(`${sqlKey} = ?`); params.push((data as Record<string, unknown>)[jsKey]) }
  }
  setClauses.push('updated_at = ?')
  params.push(now, id, businessId)
  await dbExecute(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ? AND business_id = ?`, params)
  await recordAuditEvent({ businessId, action: 'UPDATED', entityType: 'PRODUCT', entityId: id, newValues: data as Record<string, unknown> })
  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM products WHERE id = ?`, [id])
  return rowToProduct(rows[0])
}

export async function getProduct(id: string): Promise<Product | null> {
  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM products WHERE id = ?`, [id])
  return rows.length > 0 ? rowToProduct(rows[0]) : null
}

export async function listProducts(options: {
  businessId: string
  search?: string
  categoryId?: string
  isActive?: boolean
  lowStockOnly?: boolean
  page?: number
  pageSize?: number
}): Promise<{ data: ProductWithDetails[]; total: number }> {
  const conditions: string[] = ['p.business_id = ?']
  const params: unknown[] = [options.businessId]

  if (options.search) {
    conditions.push('(p.name LIKE ? OR p.product_code LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.hsn_code LIKE ?)')
    const term = `%${options.search}%`
    params.push(term, term, term, term, term)
  }
  if (options.categoryId) { conditions.push('p.category_id = ?'); params.push(options.categoryId) }
  if (options.isActive !== undefined) { conditions.push('p.is_active = ?'); params.push(options.isActive ? 1 : 0) }

  const where = conditions.join(' AND ')
  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT p.*, c.name as category_name, u.abbreviation as unit_abbreviation,
         tr.name as tax_rate_name, tr.rate as tax_rate_rate,
         COALESCE(sm.stock, 0) as current_stock
       FROM products p
       LEFT JOIN product_categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       LEFT JOIN tax_rates tr ON p.tax_rate_id = tr.id
       LEFT JOIN (SELECT product_id, SUM(quantity) as stock FROM stock_movements GROUP BY product_id) sm ON p.id = sm.product_id
       WHERE ${where}
       ORDER BY p.name ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ),
    dbSelect<{ total: number }>(`SELECT COUNT(*) as total FROM products p WHERE ${where}`, params),
  ])

  const data = rows.map((r) => ({
    ...rowToProduct(r),
    categoryName: r.category_name as string | null,
    unitAbbreviation: r.unit_abbreviation as string | null,
    taxRateName: r.tax_rate_name as string | null,
    taxRatePercent: r.tax_rate_rate ? (r.tax_rate_rate as number) / 100 : null,
    currentStock: Number(r.current_stock ?? 0),
    isLowStock: Number(r.current_stock ?? 0) <= Number(r.minimum_stock ?? 0),
  })) as ProductWithDetails[]

  const filtered = options.lowStockOnly ? data.filter((p) => p.currentStock <= p.minimumStock) : data
  return { data: filtered, total: countResult[0]?.total ?? 0 }
}

export async function listCategories(businessId: string): Promise<ProductCategory[]> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM product_categories WHERE business_id = ? AND is_active = 1 ORDER BY name ASC`,
    [businessId],
  )
  return rows.map((r) => ({ id: r.id, businessId: r.business_id, name: r.name, description: r.description, parentId: r.parent_id, isActive: Boolean(r.is_active), createdAt: r.created_at, updatedAt: r.updated_at } as ProductCategory))
}

export async function listUnits(businessId: string): Promise<Unit[]> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM units WHERE business_id = ? AND is_active = 1 ORDER BY name ASC`,
    [businessId],
  )
  return rows.map((r) => ({ id: r.id, businessId: r.business_id, name: r.name, abbreviation: r.abbreviation, isActive: Boolean(r.is_active), createdAt: r.created_at } as Unit))
}

export async function listTaxRates(businessId: string): Promise<TaxRate[]> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM tax_rates WHERE business_id = ? AND is_active = 1 ORDER BY rate ASC`,
    [businessId],
  )
  return rows.map((r) => ({ id: r.id, businessId: r.business_id, name: r.name, rate: r.rate, hsnCode: r.hsn_code, isActive: Boolean(r.is_active), createdAt: r.created_at, updatedAt: r.updated_at } as TaxRate))
}

export async function seedDefaultTaxRates(businessId: string): Promise<void> {
  const existing = await listTaxRates(businessId)
  if (existing.length > 0) return

  const defaultRates = [
    { name: 'Nil (0%)', rate: 0 },
    { name: 'GST 5%', rate: 500 },
    { name: 'GST 12%', rate: 1200 },
    { name: 'GST 18%', rate: 1800 },
    { name: 'GST 28%', rate: 2800 },
  ]

  for (const r of defaultRates) {
    const id = generateId()
    const now = nowISO()
    await dbExecute(
      `INSERT INTO tax_rates (id, business_id, name, rate, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, businessId, r.name, r.rate, now, now],
    )
  }
}

export const DEFAULT_MATERIAL_UNITS: Array<{ name: string; abbreviation: string }> = [
  // Packaging / Material units
  { name: 'Bag', abbreviation: 'Bag' },
  { name: 'Bags', abbreviation: 'Bags' },
  { name: 'Pack', abbreviation: 'Pack' },
  { name: 'Packs', abbreviation: 'Packs' },
  { name: 'Box', abbreviation: 'Box' },
  { name: 'Boxes', abbreviation: 'Boxes' },
  { name: 'Carton', abbreviation: 'Ctn' },
  { name: 'Bottle', abbreviation: 'Btl' },
  { name: 'Can', abbreviation: 'Can' },
  { name: 'Tin', abbreviation: 'Tin' },
  { name: 'Drum', abbreviation: 'Drm' },
  { name: 'Barrel', abbreviation: 'Brl' },
  { name: 'Pouch', abbreviation: 'Pch' },
  { name: 'Sack', abbreviation: 'Sck' },
  { name: 'Bundle', abbreviation: 'Bdl' },
  { name: 'Roll', abbreviation: 'Rol' },
  { name: 'Strip', abbreviation: 'Stp' },
  { name: 'Tube', abbreviation: 'Tub' },
  { name: 'Bucket / Tub', abbreviation: 'Bkt' },
  { name: 'Case', abbreviation: 'Case' },
  { name: 'Crate', abbreviation: 'Crt' },
  { name: 'Jar', abbreviation: 'Jar' },
  { name: 'Sheet', abbreviation: 'Sht' },
  // Discrete units
  { name: 'Piece', abbreviation: 'Pcs' },
  { name: 'Numbers', abbreviation: 'Nos' },
  { name: 'Dozen', abbreviation: 'Doz' },
  { name: 'Set', abbreviation: 'Set' },
  { name: 'Pair', abbreviation: 'Prs' },
  // Weight units
  { name: 'Kilogram', abbreviation: 'Kg' },
  { name: 'Gram', abbreviation: 'Gm' },
  { name: 'Milligram', abbreviation: 'Mg' },
  { name: 'Quintal', abbreviation: 'Qtl' },
  { name: 'Metric Tonne', abbreviation: 'Ton' },
  // Volume units
  { name: 'Litre', abbreviation: 'L' },
  { name: 'Millilitre', abbreviation: 'ml' },
  // Dimensions & Length
  { name: 'Metre', abbreviation: 'm' },
  { name: 'Centimetre', abbreviation: 'cm' },
  { name: 'Millimetre', abbreviation: 'mm' },
  { name: 'Square Metre', abbreviation: 'sqm' },
  { name: 'Square Feet', abbreviation: 'sqft' },
  { name: 'Feet', abbreviation: 'Ft' },
  { name: 'Inch', abbreviation: 'In' },
]

export async function ensureAllDefaultUnits(businessId: string): Promise<Unit[]> {
  const existing = await listUnits(businessId)
  const existingAbbrs = new Set(existing.map((u) => u.abbreviation.toLowerCase()))
  const existingNames = new Set(existing.map((u) => u.name.toLowerCase()))

  const toAdd = DEFAULT_MATERIAL_UNITS.filter(
    (u) => !existingAbbrs.has(u.abbreviation.toLowerCase()) && !existingNames.has(u.name.toLowerCase()),
  )

  for (const u of toAdd) {
    const id = generateId()
    await dbExecute(
      `INSERT INTO units (id, business_id, name, abbreviation, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
      [id, businessId, u.name, u.abbreviation, nowISO()],
    )
  }

  return listUnits(businessId)
}

export async function seedDefaultUnits(businessId: string): Promise<void> {
  await ensureAllDefaultUnits(businessId)
}
