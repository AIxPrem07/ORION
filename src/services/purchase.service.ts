/**
 * ORION Purchase Service
 * 
 * Manages purchase lifecycle: DRAFT → FINALIZED → PAID
 * Finalization atomically: increases stock + updates supplier ledger.
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { calculateInvoiceTotals } from './gst.service'
import { recordStockMovement } from './inventory.service'
import { createLedgerEntry } from './ledger.service'
import { recordAuditEvent } from './audit.service'
import { supplierToSnapshot } from './supplier.service'
import type { Purchase, PurchaseWithItems, PurchaseItem } from '@/types/purchase'
import type { Supplier } from '@/types/supplier'

function rowToPurchase(r: Record<string, unknown>): Purchase {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    purchaseNumber: r.purchase_number as string | null,
    supplierId: r.supplier_id as string | null,
    supplierSnapshot: JSON.parse(r.supplier_snapshot as string || '{}'),
    purchaseDate: r.purchase_date as string,
    dueDate: r.due_date as string | null,
    status: r.status as Purchase['status'],
    paymentStatus: r.payment_status as Purchase['paymentStatus'],
    supplyType: r.supply_type as Purchase['supplyType'],
    subtotal: r.subtotal as number,
    discountAmount: r.discount_amount as number,
    taxableAmount: r.taxable_amount as number,
    cgstAmount: r.cgst_amount as number,
    sgstAmount: r.sgst_amount as number,
    igstAmount: r.igst_amount as number,
    totalTax: r.total_tax as number,
    roundOff: r.round_off as number,
    totalAmount: r.total_amount as number,
    paidAmount: r.paid_amount as number,
    notes: r.notes as string | null,
    createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToPurchaseItem(r: Record<string, unknown>): PurchaseItem {
  return {
    id: r.id as string,
    purchaseId: r.purchase_id as string,
    productId: r.product_id as string | null,
    productSnapshot: JSON.parse(r.product_snapshot as string || '{}'),
    lineNumber: r.line_number as number,
    description: r.description as string,
    hsnCode: r.hsn_code as string | null,
    quantity: r.quantity as number,
    unit: r.unit as string | null,
    unitPrice: r.unit_price as number,
    discountPercent: r.discount_percent as number,
    discountAmount: r.discount_amount as number,
    taxableAmount: r.taxable_amount as number,
    taxRate: r.tax_rate as number,
    cgstRate: r.cgst_rate as number,
    sgstRate: r.sgst_rate as number,
    igstRate: r.igst_rate as number,
    cgstAmount: r.cgst_amount as number,
    sgstAmount: r.sgst_amount as number,
    igstAmount: r.igst_amount as number,
    totalAmount: r.total_amount as number,
    createdAt: r.created_at as string,
  }
}

export interface CreatePurchaseInput {
  businessId: string
  supplier: Supplier | null
  purchaseNumber?: string
  purchaseDate: string
  dueDate?: string
  supplyType: 'INTRASTATE' | 'INTERSTATE'
  notes?: string
  items: Array<{
    productId: string | null
    productSnapshot: Record<string, unknown>
    description: string
    hsnCode: string
    quantity: number    // integer × 100
    unit: string
    unitPrice: number   // paise
    discountPercent: number  // basis points
    taxRate: number     // basis points
  }>
  gstInclusive?: boolean
  createdBy?: string
}

export async function createDraftPurchase(input: CreatePurchaseInput): Promise<PurchaseWithItems> {
  const id = generateId()
  const now = nowISO()

  const totals = calculateInvoiceTotals({
    supplyType: input.supplyType,
    gstInclusive: input.gstInclusive ?? false,
    lines: input.items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
      supplyType: input.supplyType,
    })),
  })

  const supplierSnapshot = input.supplier
    ? supplierToSnapshot(input.supplier)
    : { id: '', name: 'Unknown Supplier', phone: null, email: null, address: null, city: null, state: null, stateCode: null, pin: null, gstin: null }

  await dbTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO purchases
       (id, business_id, purchase_number, supplier_id, supplier_snapshot, purchase_date, due_date, status, payment_status, supply_type, subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, total_amount, paid_amount, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        id, input.businessId, input.purchaseNumber ?? null,
        input.supplier?.id ?? null, JSON.stringify(supplierSnapshot),
        input.purchaseDate, input.dueDate ?? null, input.supplyType,
        totals.subtotal, totals.discountAmount, totals.taxableAmount,
        totals.cgstAmount, totals.sgstAmount, totals.igstAmount,
        totals.totalTax, totals.roundOff, totals.grandTotal,
        input.notes ?? null, input.createdBy ?? null, now, now,
      ],
    )

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i]
      const lineResult = totals.lineResults[i]
      await tx.execute(
        `INSERT INTO purchase_items
         (id, purchase_id, product_id, product_snapshot, line_number, description, hsn_code, quantity, unit, unit_price, discount_percent, discount_amount, taxable_amount, tax_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), id, item.productId ?? null, JSON.stringify(item.productSnapshot),
          i + 1, item.description, item.hsnCode || null, item.quantity, item.unit || null,
          item.unitPrice, item.discountPercent, lineResult.discountAmount, lineResult.taxableAmount,
          item.taxRate, lineResult.cgstRate, lineResult.sgstRate, lineResult.igstRate,
          lineResult.cgstAmount, lineResult.sgstAmount, lineResult.igstAmount,
          lineResult.totalAmount, now,
        ],
      )
    }
  })

  return getPurchaseWithItems(id) as Promise<PurchaseWithItems>
}

/**
 * Finalize purchase: increase stock + create supplier ledger entry.
 */
export async function finalizePurchase(
  purchaseId: string,
  businessId: string,
  createdBy?: string,
): Promise<PurchaseWithItems> {
  const existing = await getPurchaseWithItems(purchaseId)
  if (!existing) throw new Error('Purchase not found')
  if (existing.status !== 'DRAFT') throw new Error('Only DRAFT purchases can be finalized.')

  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `UPDATE purchases SET status = 'FINALIZED', updated_at = ? WHERE id = ?`,
      [now, purchaseId],
    )

    for (const item of existing.items) {
      if (!item.productId) continue
      const actualQty = Math.round(item.quantity / 100)
      if (actualQty <= 0) continue

      await recordStockMovement({
        businessId,
        productId: item.productId,
        movementType: 'PURCHASE',
        quantity: actualQty,
        referenceType: 'PURCHASE',
        referenceId: purchaseId,
        notes: `Purchase: ${existing.purchaseNumber ?? purchaseId}`,
        createdBy,
      }, tx)
    }

    if (existing.supplierId) {
      await createLedgerEntry({
        businessId,
        entryDate: existing.purchaseDate,
        partyType: 'SUPPLIER',
        partyId: existing.supplierId,
        referenceType: 'PURCHASE',
        referenceId: purchaseId,
        description: `Purchase ${existing.purchaseNumber ?? 'from supplier'} — ${existing.supplierSnapshot.name}`,
        debit: 0,
        credit: existing.totalAmount,
      }, tx)
    }
  })

  await recordAuditEvent({
    businessId, userId: createdBy, action: 'FINALIZED',
    entityType: 'INVOICE', entityId: purchaseId,
    newValues: { status: 'FINALIZED' },
  })

  return getPurchaseWithItems(purchaseId) as Promise<PurchaseWithItems>
}

export async function getPurchaseWithItems(id: string): Promise<PurchaseWithItems | null> {
  const [purchaseRows, itemRows] = await Promise.all([
    dbSelect<Record<string, unknown>>(`SELECT * FROM purchases WHERE id = ?`, [id]),
    dbSelect<Record<string, unknown>>(
      `SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY line_number ASC`, [id]
    ),
  ])
  if (purchaseRows.length === 0) return null
  return { ...rowToPurchase(purchaseRows[0]), items: itemRows.map(rowToPurchaseItem) }
}

export async function listPurchases(filters: {
  businessId: string
  search?: string
  supplierId?: string
  status?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}): Promise<{ data: Purchase[]; total: number }> {
  const conditions: string[] = ['business_id = ?']
  const params: unknown[] = [filters.businessId]

  if (filters.supplierId) { conditions.push('supplier_id = ?'); params.push(filters.supplierId) }
  if (filters.status) { conditions.push('status = ?'); params.push(filters.status) }
  if (filters.fromDate) { conditions.push('purchase_date >= ?'); params.push(filters.fromDate) }
  if (filters.toDate) { conditions.push('purchase_date <= ?'); params.push(filters.toDate) }

  const where = conditions.join(' AND ')
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT * FROM purchases WHERE ${where} ORDER BY purchase_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ),
    dbSelect<{ total: number }>(`SELECT COUNT(*) as total FROM purchases WHERE ${where}`, params),
  ])

  return { data: rows.map(rowToPurchase), total: countResult[0]?.total ?? 0 }
}
