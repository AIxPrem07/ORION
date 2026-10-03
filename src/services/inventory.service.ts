/**
 * ORION Inventory Service
 * 
 * Transaction-based stock management.
 * Stock is NEVER a manually edited number — it's always derived from movements.
 * 
 * Stock = opening_stock + purchases + sale_returns - sales - purchase_returns - damages
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { normalizeError } from '@utils/error'
import { recordAuditEvent } from './audit.service'
import type {
  StockMovement,
  StockMovementType,
  StockReferenceType,
  CurrentStock,
  ManualStockEntryInput,
  MonthlyProductStockSummary,
  MonthlyStockMovementDetail,
  MonthlyInventoryReportData,
} from '@/types/inventory'

/**
 * Get current calculated stock for a product.
 * Computed from stock_movements table — never from a stored field.
 */
export async function getCurrentStock(productId: string): Promise<number> {
  const rows = await dbSelect<{ stock: number }>(
    `SELECT COALESCE(SUM(quantity), 0) as stock FROM stock_movements WHERE product_id = ?`,
    [productId],
  )
  return rows[0]?.stock ?? 0
}

/**
 * Get current stock for multiple products at once (efficient batch query).
 */
export async function getStockForProducts(
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()
  const placeholders = productIds.map(() => '?').join(',')
  const rows = await dbSelect<{ product_id: string; stock: number }>(
    `SELECT product_id, COALESCE(SUM(quantity), 0) as stock
     FROM stock_movements
     WHERE product_id IN (${placeholders})
     GROUP BY product_id`,
    productIds,
  )
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.product_id, row.stock)
  }
  // Products with no movements have 0 stock
  for (const id of productIds) {
    if (!map.has(id)) map.set(id, 0)
  }
  return map
}

export interface StockMovementInput {
  businessId: string
  productId: string
  movementType: StockMovementType
  quantity: number        // positive = in, negative = out
  referenceType?: string
  referenceId?: string
  notes?: string
  createdBy?: string
  createdAt?: string
}

/**
 * Record a stock movement.
 * Must be called WITHIN a transaction for invoice/purchase operations.
 * Validates that stock doesn't go below 0 (unless explicitly allowed).
 */
export async function recordStockMovement(
  input: StockMovementInput,
  tx?: { select: typeof dbSelect; execute: typeof dbExecute },
): Promise<StockMovement> {
  const executor = tx ?? { select: dbSelect, execute: dbExecute }

  // Get current stock before this movement
  const currentRows = await executor.select<{ stock: number }>(
    `SELECT COALESCE(SUM(quantity), 0) as stock FROM stock_movements WHERE product_id = ?`,
    [input.productId],
  )
  const quantityBefore = currentRows[0]?.stock ?? 0
  const quantityAfter = quantityBefore + input.quantity

  // Prevent negative stock (allow ADJUSTMENT and DAMAGE to override)
  const allowNegative = ['ADJUSTMENT', 'DAMAGE'].includes(input.movementType)
  if (!allowNegative && quantityAfter < 0) {
    throw new Error(
      `Insufficient stock for product. Available: ${quantityBefore}, required: ${Math.abs(input.quantity)}`,
    )
  }

  const id = generateId()
  const createdAt = input.createdAt ?? nowISO()
  await executor.execute(
    `INSERT INTO stock_movements
     (id, business_id, product_id, movement_type, reference_type, reference_id, quantity, quantity_before, quantity_after, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.businessId,
      input.productId,
      input.movementType,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.quantity,
      quantityBefore,
      quantityAfter,
      input.notes ?? null,
      input.createdBy ?? null,
      createdAt,
    ],
  )

  return {
    id,
    businessId: input.businessId,
    productId: input.productId,
    movementType: input.movementType,
    referenceType: (input.referenceType as StockReferenceType) ?? null,
    referenceId: input.referenceId ?? null,
    quantity: input.quantity,
    quantityBefore,
    quantityAfter,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
    createdAt,
  }
}

/**
 * Set opening stock for a product.
 * Replaces any existing opening stock movement.
 */
export async function setOpeningStock(input: {
  businessId: string
  productId: string
  quantity: number
  createdBy?: string
}): Promise<void> {
  await dbTransaction(async (tx) => {
    // Remove any existing opening stock entry
    await tx.execute(
      `DELETE FROM stock_movements WHERE product_id = ? AND movement_type = 'OPENING'`,
      [input.productId],
    )

    if (input.quantity !== 0) {
      await tx.execute(
        `INSERT INTO stock_movements
         (id, business_id, product_id, movement_type, reference_type, reference_id, quantity, quantity_before, quantity_after, notes, created_by, created_at)
         VALUES (?, ?, ?, 'OPENING', NULL, NULL, ?, 0, ?, 'Opening stock', ?, ?)`,
        [
          generateId(),
          input.businessId,
          input.productId,
          input.quantity,
          input.quantity,
          input.createdBy ?? null,
          nowISO(),
        ],
      )
    }
  })
}

/**
 * Manual stock adjustment — sets stock to a specific level.
 * Records the difference as an ADJUSTMENT movement.
 */
export async function adjustStock(input: {
  businessId: string
  productId: string
  adjustedQuantity: number
  notes: string
  createdBy?: string
}): Promise<void> {
  await dbTransaction(async (tx) => {
    const currentRows = await tx.select<{ stock: number }>(
      `SELECT COALESCE(SUM(quantity), 0) as stock FROM stock_movements WHERE product_id = ?`,
      [input.productId],
    )
    const currentStock = currentRows[0]?.stock ?? 0
    const difference = input.adjustedQuantity - currentStock

    if (difference === 0) return

    const id = generateId()
    await tx.execute(
      `INSERT INTO stock_movements
       (id, business_id, product_id, movement_type, reference_type, reference_id, quantity, quantity_before, quantity_after, notes, created_by, created_at)
       VALUES (?, ?, ?, 'ADJUSTMENT', NULL, NULL, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.businessId,
        input.productId,
        difference,
        currentStock,
        input.adjustedQuantity,
        input.notes,
        input.createdBy ?? null,
        nowISO(),
      ],
    )
  })

  await recordAuditEvent({
    businessId: input.businessId,
    userId: input.createdBy,
    action: 'STOCK_ADJUSTED',
    entityType: 'STOCK',
    entityId: input.productId,
    newValues: { adjustedQuantity: input.adjustedQuantity, notes: input.notes },
  })
}

/**
 * Get all products with current stock levels.
 * Includes low-stock indicators.
 */
export async function getAllCurrentStock(businessId: string): Promise<CurrentStock[]> {
  const rows = await dbSelect<{
    product_id: string
    product_name: string
    product_code: string | null
    unit_abbreviation: string | null
    minimum_stock: number
    current_stock: number
  }>(
    `SELECT
       p.id as product_id,
       p.name as product_name,
       p.product_code,
       u.abbreviation as unit_abbreviation,
       p.minimum_stock,
       COALESCE(sm.stock, 0) as current_stock
     FROM products p
     LEFT JOIN units u ON p.unit_id = u.id
     LEFT JOIN (
       SELECT product_id, SUM(quantity) as stock
       FROM stock_movements
       GROUP BY product_id
     ) sm ON p.id = sm.product_id
     WHERE p.business_id = ? AND p.is_active = 1
     ORDER BY p.name ASC`,
    [businessId],
  )

  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    productCode: r.product_code,
    unitAbbreviation: r.unit_abbreviation,
    currentStock: r.current_stock,
    minimumStock: r.minimum_stock,
    isLowStock: r.current_stock <= r.minimum_stock,
  }))
}

export async function getStockMovements(
  productId: string,
  options?: { page?: number; pageSize?: number },
): Promise<{ data: StockMovement[]; total: number }> {
  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [productId, pageSize, offset],
    ),
    dbSelect<{ total: number }>(
      `SELECT COUNT(*) as total FROM stock_movements WHERE product_id = ?`,
      [productId],
    ),
  ])

  return {
    data: rows as unknown as StockMovement[],
    total: countResult[0]?.total ?? 0,
  }
}

function parseCustomDateTime(dt?: string): string {
  if (!dt) return nowISO()
  try {
    const d = new Date(dt)
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch {
    // fallback
  }
  return nowISO()
}

/**
 * Add or adjust stock manually for any product.
 * Supports:
 * - ADD: Inward stock addition (+qty)
 * - DEDUCT: Outward stock deduction (-qty, e.g. damage/spoilage)
 * - SET: Set exact physical stock count (calculates difference automatically)
 * Records exact date & time, product details, stock before & after, and audit trail.
 */
export async function addManualStockEntry(input: ManualStockEntryInput): Promise<{
  movement: StockMovement
  productName: string
  quantityBefore: number
  quantityAfter: number
}> {
  return await dbTransaction(async (tx) => {
    // 1. Fetch product
    const prodRows = await tx.select<{ id: string; name: string }>(
      `SELECT id, name FROM products WHERE id = ? AND business_id = ?`,
      [input.productId, input.businessId],
    )
    if (prodRows.length === 0) {
      throw new Error('Product not found')
    }
    const productName = prodRows[0].name

    // 2. Fetch current stock
    const curRows = await tx.select<{ stock: number }>(
      `SELECT COALESCE(SUM(quantity), 0) as stock FROM stock_movements WHERE product_id = ?`,
      [input.productId],
    )
    const currentStock = curRows[0]?.stock ?? 0

    let movementQty = 0
    let movementType: StockMovementType = input.movementType || 'ADJUSTMENT'

    if (input.mode === 'ADD') {
      const addQty = Math.abs(input.quantity)
      if (addQty === 0) throw new Error('Quantity to add must be greater than 0')
      movementQty = addQty
      movementType = input.movementType || 'PURCHASE'
    } else if (input.mode === 'DEDUCT') {
      const deductQty = Math.abs(input.quantity)
      if (deductQty === 0) throw new Error('Quantity to deduct must be greater than 0')
      movementQty = -deductQty
      movementType = input.movementType || 'DAMAGE'
    } else if (input.mode === 'SET') {
      const targetQty = input.quantity
      movementQty = targetQty - currentStock
      movementType = input.movementType || 'ADJUSTMENT'
    }

    const quantityBefore = currentStock
    const quantityAfter = currentStock + movementQty

    // Prevent negative stock unless it's an adjustment or damage
    if (quantityAfter < 0 && !['ADJUSTMENT', 'DAMAGE'].includes(movementType)) {
      throw new Error(`Insufficient stock. Current: ${currentStock}, requested deduction: ${Math.abs(movementQty)}`)
    }

    const id = generateId()
    const createdAt = parseCustomDateTime(input.customDateTime)

    await tx.execute(
      `INSERT INTO stock_movements
       (id, business_id, product_id, movement_type, reference_type, reference_id, quantity, quantity_before, quantity_after, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, 'MANUAL_ENTRY', NULL, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.businessId,
        input.productId,
        movementType,
        movementQty,
        quantityBefore,
        quantityAfter,
        input.notes ?? `Manual stock update (${input.mode})`,
        input.createdBy ?? null,
        createdAt,
      ],
    )

    await recordAuditEvent({
      businessId: input.businessId,
      userId: input.createdBy,
      action: 'STOCK_ADJUSTED',
      entityType: 'STOCK',
      entityId: input.productId,
      newValues: {
        productName,
        mode: input.mode,
        movementType,
        quantityChanged: movementQty,
        quantityBefore,
        quantityAfter,
        notes: input.notes,
        createdAt,
      },
    })

    const movement: StockMovement = {
      id,
      businessId: input.businessId,
      productId: input.productId,
      movementType,
      referenceType: 'ADJUSTMENT',
      referenceId: null,
      quantity: movementQty,
      quantityBefore,
      quantityAfter,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      createdAt,
    }

    return {
      movement,
      productName,
      quantityBefore,
      quantityAfter,
    }
  })
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Get monthly inventory statement:
 * - Product-wise opening stock, inward stock, outward stock, and closing stock
 * - Detailed itemized stock movements with exact timestamp (date & time) and product name
 */
export async function getMonthlyInventoryReport(
  businessId: string,
  year: number,
  month: number, // 1 to 12
): Promise<MonthlyInventoryReportData> {
  const monthIndex = Math.max(0, Math.min(11, month - 1))
  const monthName = MONTH_NAMES[monthIndex]

  const pad = (n: number) => String(n).padStart(2, '0')
  const startDay = `${year}-${pad(month)}-01`
  const lastDayNum = new Date(year, month, 0).getDate()
  const endDay = `${year}-${pad(month)}-${pad(lastDayNum)}`

  const startISO = `${startDay}T00:00:00.000Z`
  const endISO = `${endDay}T23:59:59.999Z`

  // 1. Fetch product summaries with opening, inward, outward, closing
  const productRows = await dbSelect<{
    product_id: string
    product_name: string
    product_code: string | null
    unit_abbreviation: string | null
    minimum_stock: number
    opening_stock: number
    inward_stock: number
    outward_stock: number
    closing_stock: number
  }>(
    `SELECT 
       p.id as product_id,
       p.name as product_name,
       p.product_code,
       u.abbreviation as unit_abbreviation,
       p.minimum_stock,
       COALESCE(SUM(CASE WHEN sm.created_at < ? THEN sm.quantity ELSE 0 END), 0) as opening_stock,
       COALESCE(SUM(CASE WHEN sm.created_at >= ? AND sm.created_at <= ? AND sm.quantity > 0 THEN sm.quantity ELSE 0 END), 0) as inward_stock,
       COALESCE(SUM(CASE WHEN sm.created_at >= ? AND sm.created_at <= ? AND sm.quantity < 0 THEN ABS(sm.quantity) ELSE 0 END), 0) as outward_stock,
       COALESCE(SUM(CASE WHEN sm.created_at <= ? THEN sm.quantity ELSE 0 END), 0) as closing_stock
     FROM products p
     LEFT JOIN units u ON p.unit_id = u.id
     LEFT JOIN stock_movements sm ON p.id = sm.product_id AND sm.business_id = p.business_id
     WHERE p.business_id = ? AND p.is_active = 1
     GROUP BY p.id
     ORDER BY p.name ASC`,
    [startISO, startISO, endISO, startISO, endISO, endISO, businessId],
  )

  const products: MonthlyProductStockSummary[] = productRows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    productCode: r.product_code,
    unitAbbreviation: r.unit_abbreviation,
    minimumStock: Number(r.minimum_stock ?? 0),
    openingStock: Number(r.opening_stock ?? 0),
    inwardStock: Number(r.inward_stock ?? 0),
    outwardStock: Number(r.outward_stock ?? 0),
    closingStock: Number(r.closing_stock ?? 0),
    isLowStock: Number(r.closing_stock ?? 0) <= Number(r.minimum_stock ?? 0),
  }))

  // 2. Fetch movements for this month with exact timestamps and product details
  const movementRows = await dbSelect<{
    id: string
    created_at: string
    product_id: string
    product_name: string
    product_code: string | null
    unit_abbreviation: string | null
    movement_type: string
    quantity: number
    quantity_before: number
    quantity_after: number
    notes: string | null
  }>(
    `SELECT 
       sm.id,
       sm.created_at,
       sm.product_id,
       p.name as product_name,
       p.product_code,
       u.abbreviation as unit_abbreviation,
       sm.movement_type,
       sm.quantity,
       sm.quantity_before,
       sm.quantity_after,
       sm.notes
     FROM stock_movements sm
     JOIN products p ON sm.product_id = p.id
     LEFT JOIN units u ON p.unit_id = u.id
     WHERE sm.business_id = ? AND sm.created_at >= ? AND sm.created_at <= ?
     ORDER BY sm.created_at DESC`,
    [businessId, startISO, endISO],
  )

  const movements: MonthlyStockMovementDetail[] = movementRows.map((m) => ({
    id: m.id,
    createdAt: m.created_at,
    productId: m.product_id,
    productName: m.product_name,
    productCode: m.product_code,
    unitAbbreviation: m.unit_abbreviation,
    movementType: m.movement_type,
    quantity: Number(m.quantity ?? 0),
    quantityBefore: Number(m.quantity_before ?? 0),
    quantityAfter: Number(m.quantity_after ?? 0),
    notes: m.notes,
  }))

  const totalOpeningStock = products.reduce((acc, p) => acc + p.openingStock, 0)
  const totalInwardStock = products.reduce((acc, p) => acc + p.inwardStock, 0)
  const totalOutwardStock = products.reduce((acc, p) => acc + p.outwardStock, 0)
  const totalClosingStock = products.reduce((acc, p) => acc + p.closingStock, 0)

  return {
    year,
    month,
    monthName,
    startDate: startDay,
    endDate: endDay,
    products,
    movements,
    totalOpeningStock,
    totalInwardStock,
    totalOutwardStock,
    totalClosingStock,
  }
}
