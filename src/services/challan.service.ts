/**
 * ORION Delivery Challan Service
 * 
 * Manages Delivery Challans:
 * - Generates sequential Challan numbers partitioned by Financial Year (starts at 1 per FY).
 * - Deducts stock from warehouse inventory upon dispatch.
 * - Posts a Debit entry to the Customer's Ledger (without affecting cash inflow/outflow).
 * - Excludes GST completely.
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO, getFinancialYearFromDate, currentFinancialYear, financialYearStart, financialYearEnd } from '@utils/date'
import { quantityToInt, rupeesToPaise } from '@utils/decimal'
import { recordStockMovement } from './inventory.service'
import { createLedgerEntry, recalculatePartyLedgerBalances } from './ledger.service'
import { recordAuditEvent } from './audit.service'
import { customerToSnapshot } from './customer.service'
import type { Challan, ChallanWithItems, ChallanItem, ChallanFormData, ChallanListFilters } from '@/types/challan'

function rowToChallan(r: Record<string, unknown>): Challan {
  let customerSnapshot = null
  if (r.customer_snapshot) {
    try {
      customerSnapshot = typeof r.customer_snapshot === 'string'
        ? JSON.parse(r.customer_snapshot)
        : r.customer_snapshot
    } catch {
      customerSnapshot = null
    }
  }

  return {
    id: r.id as string,
    businessId: r.business_id as string,
    challanNumber: r.challan_number as string,
    financialYear: r.financial_year as string,
    customerId: (r.customer_id as string) || null,
    customerSnapshot,
    challanDate: r.challan_date as string,
    status: (r.status as Challan['status']) || 'DELIVERED',
    subtotal: Number(r.subtotal ?? 0),
    totalAmount: Number(r.total_amount ?? 0),
    notes: (r.notes as string) || null,
    transportMode: (r.transport_mode as string) || null,
    vehicleNumber: (r.vehicle_number as string) || null,
    transporterName: (r.transporter_name as string) || null,
    lrRrNumber: (r.lr_rr_number as string) || null,
    createdBy: (r.created_by as string) || null,
    isDeleted: Boolean(r.is_deleted),
    deletedAt: (r.deleted_at as string) || null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToChallanItem(r: Record<string, unknown>): ChallanItem {
  return {
    id: r.id as string,
    challanId: r.challan_id as string,
    productId: (r.product_id as string) || null,
    description: r.description as string,
    hsnCode: (r.hsn_code as string) || null,
    quantity: Number(r.quantity ?? 0),
    unit: (r.unit as string) || 'Nos',
    unitPrice: Number(r.unit_price ?? 0),
    totalAmount: Number(r.total_amount ?? 0),
    sortOrder: Number(r.sort_order ?? 0),
  }
}

/**
 * Atomically obtain next sequential challan number for a given Financial Year.
 * Starts at 1 for every new Financial Year. Format: CH/26-27/0001
 */
export async function getNextChallanNumber(
  businessId: string,
  financialYear: string = currentFinancialYear(),
  prefix: string = 'CH',
): Promise<string> {
  return dbTransaction(async (tx) => {
    const existing = await tx.select<{ id: string; current_number: number; padding: number }>(
      `SELECT id, current_number, padding FROM challan_sequences
       WHERE business_id = ? AND prefix = ? AND financial_year = ?
       LIMIT 1`,
      [businessId, prefix, financialYear],
    )

    let nextNum = 1
    const padding = 4

    if (existing.length === 0) {
      const seqId = generateId()
      await tx.execute(
        `INSERT INTO challan_sequences (id, business_id, prefix, financial_year, current_number, padding, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        [seqId, businessId, prefix, financialYear, padding, nowISO(), nowISO()],
      )
    } else {
      nextNum = existing[0].current_number + 1
      await tx.execute(
        `UPDATE challan_sequences SET current_number = ?, updated_at = ? WHERE id = ?`,
        [nextNum, nowISO(), existing[0].id],
      )
    }

    const padded = String(nextNum).padStart(padding, '0')
    return `${prefix}/${financialYear}/${padded}`
  })
}

/**
 * Create a new Delivery Challan.
 * - Deducts product stock.
 * - Creates a debit entry in the customer's ledger.
 * - No GST and no cash flow effects.
 */
export async function createChallan(
  businessId: string,
  data: ChallanFormData,
  userId?: string,
): Promise<ChallanWithItems> {
  const challanId = generateId()
  const now = nowISO()
  const fy = data.financialYear || getFinancialYearFromDate(data.challanDate)

  // Calculate items and total amount
  let totalAmount = 0
  const parsedItems = data.items.map((it, idx) => {
    const qty = Math.round(parseFloat(it.quantity || '0') * 100)
    const ratePaise = rupeesToPaise(parseFloat(it.unitPrice || '0'))
    const lineTotal = Math.round((qty / 100) * ratePaise)
    totalAmount += lineTotal
    return {
      id: generateId(),
      challanId,
      productId: it.productId?.trim() ? it.productId.trim() : null,
      description: it.description || 'Item',
      hsnCode: it.hsnCode?.trim() || null,
      quantity: qty,
      unit: it.unit || 'Nos',
      unitPrice: ratePaise,
      totalAmount: lineTotal,
      sortOrder: idx,
    }
  })

  // Customer snapshot
  const customerSnapshot = data.customer
    ? customerToSnapshot(data.customer)
    : { id: data.customerId || '', name: 'Walk-in Customer', phone: null, email: null, address: null, city: null, state: null, stateCode: null, pin: null, gstin: null, pan: null }

  return dbTransaction(async (tx) => {
    const challanNum = data.challanNumber?.trim() || await getNextChallanNumber(businessId, fy)

    // Validate userId against users table
    let validUserId: string | null = null
    if (userId && userId.trim()) {
      const userRows = await tx.select<{ id: string }>(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId.trim()])
      if (userRows.length > 0) {
        validUserId = userId.trim()
      }
    }

    // Validate customerId against customers table
    let validCustomerId: string | null = null
    if (data.customerId && data.customerId.trim()) {
      const custRows = await tx.select<{ id: string }>(`SELECT id FROM customers WHERE id = ? LIMIT 1`, [data.customerId.trim()])
      if (custRows.length > 0) {
        validCustomerId = data.customerId.trim()
      }
    }

    // 1. Insert challan header
    await tx.execute(
      `INSERT INTO challans (
        id, business_id, challan_number, financial_year, customer_id, customer_snapshot,
        challan_date, status, subtotal, total_amount, notes,
        transport_mode, vehicle_number, transporter_name, lr_rr_number,
        created_by, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DELIVERED', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        challanId,
        businessId,
        challanNum,
        fy,
        validCustomerId,
        JSON.stringify(customerSnapshot),
        data.challanDate,
        totalAmount,
        totalAmount,
        data.notes || null,
        data.transportMode || null,
        data.vehicleNumber || null,
        data.transporterName || null,
        data.lrRrNumber || null,
        validUserId,
        now,
        now,
      ],
    )

    // 2. Insert items and handle stock deduction
    for (const it of parsedItems) {
      // Validate productId against products table
      let validProductId: string | null = null
      if (it.productId) {
        const prodRows = await tx.select<{ id: string }>(`SELECT id FROM products WHERE id = ? LIMIT 1`, [it.productId])
        if (prodRows.length > 0) {
          validProductId = it.productId
        }
      }

      await tx.execute(
        `INSERT INTO challan_items (
          id, challan_id, product_id, description, hsn_code, quantity, unit, unit_price, total_amount, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [it.id, it.challanId, validProductId, it.description, it.hsnCode, it.quantity, it.unit, it.unitPrice, it.totalAmount, it.sortOrder],
      )

      // 3. Deduct stock for verified inventory products
      if (validProductId) {
        const actualQty = Math.round(it.quantity / 100)
        if (actualQty > 0) {
          await recordStockMovement(
            {
              businessId,
              productId: validProductId,
              movementType: 'SALE',
              quantity: -actualQty,
              referenceType: 'CHALLAN',
              referenceId: challanId,
              notes: `Dispatched on Challan #${challanNum}`,
              createdBy: validUserId || undefined,
              createdAt: data.challanDate,
              allowNegative: true,
            },
            tx,
          )
        }
      }
    }

    // 4. Record Customer Ledger Entry (Goods dispatched on Challan)
    if (validCustomerId && totalAmount > 0) {
      await createLedgerEntry(
        {
          businessId,
          partyType: 'CUSTOMER',
          partyId: validCustomerId,
          referenceType: 'CHALLAN',
          referenceId: challanId,
          debit: totalAmount,
          credit: 0,
          description: `Delivery Challan #${challanNum}`,
          entryDate: data.challanDate,
        },
        tx,
      )
      await recalculatePartyLedgerBalances(businessId, 'CUSTOMER', validCustomerId, tx)
    }

    return {
      id: challanId,
      businessId,
      challanNumber: challanNum,
      financialYear: fy,
      customerId: validCustomerId,
      customerSnapshot,
      challanDate: data.challanDate,
      status: 'DELIVERED',
      subtotal: totalAmount,
      totalAmount,
      notes: data.notes || null,
      transportMode: data.transportMode || null,
      vehicleNumber: data.vehicleNumber || null,
      transporterName: data.transporterName || null,
      lrRrNumber: data.lrRrNumber || null,
      createdBy: validUserId,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      items: parsedItems.map((item) => ({
        ...item,
        productId: item.productId || null,
      })),
    }
  })
}

/**
 * Retrieve a delivery challan with items.
 */
export async function getChallanWithItems(id: string): Promise<ChallanWithItems | null> {
  const [challanRows, itemRows] = await Promise.all([
    dbSelect<Record<string, unknown>>(`SELECT * FROM challans WHERE id = ?`, [id]),
    dbSelect<Record<string, unknown>>(`SELECT * FROM challan_items WHERE challan_id = ? ORDER BY sort_order ASC`, [id]),
  ])

  if (challanRows.length === 0) return null
  return {
    ...rowToChallan(challanRows[0]),
    items: itemRows.map(rowToChallanItem),
  }
}

/**
 * List delivery challans with optional FY and search filters.
 */
export async function listChallans(
  filters: ChallanListFilters,
): Promise<{ data: Challan[]; total: number }> {
  const conditions: string[] = ['business_id = ?', 'COALESCE(is_deleted, 0) = 0']
  const params: unknown[] = [filters.businessId]

  if (filters.financialYear && filters.financialYear !== 'ALL') {
    conditions.push('(financial_year = ? OR challan_date BETWEEN ? AND ?)')
    params.push(filters.financialYear, financialYearStart(filters.financialYear), financialYearEnd(filters.financialYear))
  }

  if (filters.search) {
    conditions.push('(challan_number LIKE ? OR json_extract(customer_snapshot, "$.name") LIKE ? OR notes LIKE ?)')
    const term = `%${filters.search}%`
    params.push(term, term, term)
  }

  if (filters.customerId) {
    conditions.push('customer_id = ?')
    params.push(filters.customerId)
  }

  if (filters.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }

  const where = conditions.join(' AND ')
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT * FROM challans WHERE ${where} ORDER BY challan_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ),
    dbSelect<{ total: number }>(
      `SELECT COUNT(*) as total FROM challans WHERE ${where}`,
      params,
    ),
  ])

  return {
    data: rows.map(rowToChallan),
    total: countResult[0]?.total ?? 0,
  }
}

/**
 * Delete a delivery challan.
 * - Reverses stock movements (restoring stock).
 * - Removes customer ledger entry and recalculates customer balance.
 * - Deletes the challan record.
 */
export async function deleteChallan(
  challanId: string,
  businessId: string,
  userId?: string,
): Promise<void> {
  const existing = await getChallanWithItems(challanId)
  if (!existing) throw new Error('Challan not found')

  await dbTransaction(async (tx) => {
    // 1. Remove ledger entry and recalculate
    await tx.execute(
      `DELETE FROM ledger_entries WHERE business_id = ? AND reference_type = 'CHALLAN' AND reference_id = ?`,
      [businessId, challanId],
    )
    if (existing.customerId) {
      await recalculatePartyLedgerBalances(businessId, 'CUSTOMER', existing.customerId, tx)
    }

    // 2. Remove stock movements (restores inventory balance)
    await tx.execute(
      `DELETE FROM stock_movements WHERE business_id = ? AND reference_type = 'CHALLAN' AND reference_id = ?`,
      [businessId, challanId],
    )

    // 3. Delete items and header
    await tx.execute(`DELETE FROM challan_items WHERE challan_id = ?`, [challanId])
    await tx.execute(`DELETE FROM challans WHERE id = ? AND business_id = ?`, [challanId, businessId])
  })

  await recordAuditEvent({
    businessId,
    userId,
    action: 'DELETED',
    entityType: 'CHALLAN',
    entityId: challanId,
    newValues: { challanNumber: existing.challanNumber, customerId: existing.customerId },
  })
}
