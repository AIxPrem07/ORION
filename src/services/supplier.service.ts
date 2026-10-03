/**
 * ORION Supplier Service
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { recordAuditEvent } from './audit.service'
import { createLedgerEntry } from './ledger.service'
import type { Supplier, SupplierFormData, SupplierSummary, SupplierSnapshot } from '@/types/supplier'

function rowToSupplier(r: Record<string, unknown>): Supplier {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    supplierCode: r.supplier_code as string | null,
    name: r.name as string,
    phone: r.phone as string | null,
    email: r.email as string | null,
    address: r.address as string | null,
    city: r.city as string | null,
    state: r.state as string | null,
    stateCode: r.state_code as string | null,
    pin: r.pin as string | null,
    gstin: r.gstin as string | null,
    pan: r.pan as string | null,
    openingBalance: r.opening_balance as number,
    paymentTerms: r.payment_terms as number,
    notes: r.notes as string | null,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export function supplierToSnapshot(supplier: Supplier): SupplierSnapshot {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    city: supplier.city,
    state: supplier.state,
    stateCode: supplier.stateCode,
    pin: supplier.pin,
    gstin: supplier.gstin,
  }
}

export async function createSupplier(businessId: string, data: SupplierFormData): Promise<Supplier> {
  const id = generateId()
  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO suppliers
       (id, business_id, supplier_code, name, phone, email, address, city, state, state_code, pin, gstin, pan, opening_balance, payment_terms, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, businessId, data.supplierCode ?? null, data.name, data.phone ?? null, data.email ?? null,
       data.address ?? null, data.city ?? null, data.state ?? null, data.stateCode ?? null,
       data.pin ?? null, data.gstin ?? null, data.pan ?? null, data.openingBalance ?? 0,
       data.paymentTerms ?? 0, data.notes ?? null, now, now],
    )

    if (data.openingBalance && data.openingBalance !== 0) {
      await createLedgerEntry({
        businessId,
        entryDate: now.slice(0, 10),
        partyType: 'SUPPLIER',
        partyId: id,
        referenceType: 'OPENING',
        description: `Opening balance — ${data.name}`,
        debit: data.openingBalance < 0 ? Math.abs(data.openingBalance) : 0,
        credit: data.openingBalance > 0 ? data.openingBalance : 0,
      }, tx)
    }
  })

  await recordAuditEvent({
    businessId,
    action: 'CREATED',
    entityType: 'SUPPLIER',
    entityId: id,
    newValues: { name: data.name },
  })

  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM suppliers WHERE id = ?`, [id])
  return rowToSupplier(rows[0])
}

export async function updateSupplier(
  id: string,
  businessId: string,
  data: Partial<SupplierFormData>,
): Promise<Supplier> {
  const now = nowISO()
  const fieldMap: Record<string, string> = {
    supplierCode: 'supplier_code', name: 'name', phone: 'phone', email: 'email',
    address: 'address', city: 'city', state: 'state', stateCode: 'state_code',
    pin: 'pin', gstin: 'gstin', pan: 'pan', paymentTerms: 'payment_terms',
    notes: 'notes', isActive: 'is_active',
  }

  const setClauses: string[] = []
  const params: unknown[] = []

  for (const [jsKey, sqlKey] of Object.entries(fieldMap)) {
    if (jsKey in data) {
      setClauses.push(`${sqlKey} = ?`)
      params.push((data as Record<string, unknown>)[jsKey])
    }
  }

  setClauses.push('updated_at = ?')
  params.push(now, id, businessId)

  await dbExecute(
    `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id = ? AND business_id = ?`,
    params,
  )

  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM suppliers WHERE id = ?`, [id])
  return rowToSupplier(rows[0])
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM suppliers WHERE id = ?`, [id]
  )
  return rows.length > 0 ? rowToSupplier(rows[0]) : null
}

export async function listSuppliers(options: {
  businessId: string
  search?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<{ data: Supplier[]; total: number }> {
  const conditions: string[] = ['business_id = ?']
  const params: unknown[] = [options.businessId]

  if (options.search) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR gstin LIKE ? OR supplier_code LIKE ?)')
    const term = `%${options.search}%`
    params.push(term, term, term, term, term)
  }
  if (options.isActive !== undefined) {
    conditions.push('is_active = ?')
    params.push(options.isActive ? 1 : 0)
  }

  const where = conditions.join(' AND ')
  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT * FROM suppliers WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ),
    dbSelect<{ total: number }>(
      `SELECT COUNT(*) as total FROM suppliers WHERE ${where}`,
      params,
    ),
  ])

  return { data: rows.map(rowToSupplier), total: countResult[0]?.total ?? 0 }
}

export async function getSupplierSummary(
  businessId: string,
  supplierId: string,
): Promise<SupplierSummary> {
  const [supplier, purchaseStats] = await Promise.all([
    getSupplier(supplierId),
    dbSelect<{ total_purchased: number; total_paid: number; purchase_count: number; last_date: string | null }>(
      `SELECT
         COALESCE(SUM(total_amount), 0) as total_purchased,
         COALESCE(SUM(paid_amount), 0) as total_paid,
         COUNT(*) as purchase_count,
         MAX(purchase_date) as last_date
       FROM purchases
       WHERE business_id = ? AND supplier_id = ? AND status != 'CANCELLED'`,
      [businessId, supplierId],
    ),
  ])

  const stats = purchaseStats[0]
  return {
    supplierId,
    supplierName: supplier?.name ?? '',
    totalPurchased: stats?.total_purchased ?? 0,
    totalPaid: stats?.total_paid ?? 0,
    outstanding: (stats?.total_purchased ?? 0) - (stats?.total_paid ?? 0),
    purchaseCount: stats?.purchase_count ?? 0,
    lastPurchaseDate: stats?.last_date ?? null,
  }
}
