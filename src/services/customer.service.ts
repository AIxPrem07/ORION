/**
 * ORION Customer Service
 * CRUD operations for customers with ledger integration.
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { normalizeError } from '@utils/error'
import { recordAuditEvent } from './audit.service'
import { createLedgerEntry } from './ledger.service'
import type { Customer, CustomerFormData, CustomerSummary, CustomerSnapshot } from '@/types/customer'

function rowToCustomer(r: Record<string, unknown>): Customer {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    customerCode: r.customer_code as string | null,
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
    creditLimit: r.credit_limit as number,
    paymentTerms: r.payment_terms as number,
    notes: r.notes as string | null,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export function customerToSnapshot(customer: Customer): CustomerSnapshot {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    stateCode: customer.stateCode,
    pin: customer.pin,
    gstin: customer.gstin,
    pan: customer.pan,
  }
}

export async function createCustomer(
  businessId: string,
  data: CustomerFormData,
): Promise<Customer> {
  const id = generateId()
  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO customers (id, business_id, customer_code, name, phone, email, address, city, state, state_code, pin, gstin, pan, opening_balance, credit_limit, payment_terms, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, businessId, data.customerCode, data.name, data.phone, data.email, data.address, data.city, data.state, data.stateCode, data.pin, data.gstin, data.pan, data.openingBalance, data.creditLimit, data.paymentTerms, data.notes, now, now],
    )

    // Record opening balance as ledger entry
    if (data.openingBalance !== 0) {
      await createLedgerEntry({
        businessId,
        entryDate: now.slice(0, 10),
        partyType: 'CUSTOMER',
        partyId: id,
        referenceType: 'OPENING',
        description: `Opening balance — ${data.name}`,
        debit: data.openingBalance > 0 ? data.openingBalance : 0,
        credit: data.openingBalance < 0 ? Math.abs(data.openingBalance) : 0,
      }, tx)
    }
  })

  await recordAuditEvent({ businessId, action: 'CREATED', entityType: 'CUSTOMER', entityId: id, newValues: { name: data.name } })

  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM customers WHERE id = ?`, [id])
  return rowToCustomer(rows[0])
}

export async function updateCustomer(
  id: string,
  businessId: string,
  data: Partial<CustomerFormData>,
): Promise<Customer> {
  const now = nowISO()
  const setClauses: string[] = []
  const params: unknown[] = []

  const fieldMap: Record<string, string> = {
    customerCode: 'customer_code', name: 'name', phone: 'phone', email: 'email',
    address: 'address', city: 'city', state: 'state', stateCode: 'state_code',
    pin: 'pin', gstin: 'gstin', pan: 'pan', creditLimit: 'credit_limit',
    paymentTerms: 'payment_terms', notes: 'notes', isActive: 'is_active',
  }

  for (const [jsKey, sqlKey] of Object.entries(fieldMap)) {
    if (jsKey in data) {
      setClauses.push(`${sqlKey} = ?`)
      params.push((data as Record<string, unknown>)[jsKey])
    }
  }

  setClauses.push('updated_at = ?')
  params.push(now)
  params.push(id)
  params.push(businessId)

  await dbExecute(`UPDATE customers SET ${setClauses.join(', ')} WHERE id = ? AND business_id = ?`, params)
  await recordAuditEvent({ businessId, action: 'UPDATED', entityType: 'CUSTOMER', entityId: id, newValues: data as Record<string, unknown> })

  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM customers WHERE id = ?`, [id])
  return rowToCustomer(rows[0])
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM customers WHERE id = ?`, [id])
  return rows.length > 0 ? rowToCustomer(rows[0]) : null
}

export async function listCustomers(options: {
  businessId: string
  search?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<{ data: Customer[]; total: number }> {
  const conditions: string[] = ['business_id = ?']
  const params: unknown[] = [options.businessId]

  if (options.search) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR gstin LIKE ? OR customer_code LIKE ?)')
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
    dbSelect<Record<string, unknown>>(`SELECT * FROM customers WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
    dbSelect<{ total: number }>(`SELECT COUNT(*) as total FROM customers WHERE ${where}`, params),
  ])

  return { data: rows.map(rowToCustomer), total: countResult[0]?.total ?? 0 }
}

export async function getCustomerSummary(businessId: string, customerId: string): Promise<CustomerSummary> {
  const [customer, invoiceStats] = await Promise.all([
    getCustomer(customerId),
    dbSelect<{ total_invoiced: number; total_paid: number; invoice_count: number; last_date: string | null }>(
      `SELECT
         COALESCE(SUM(total_amount), 0) as total_invoiced,
         COALESCE(SUM(paid_amount), 0) as total_paid,
         COUNT(*) as invoice_count,
         MAX(invoice_date) as last_date
       FROM invoices
       WHERE business_id = ? AND customer_id = ? AND status != 'CANCELLED' AND COALESCE(is_deleted, 0) = 0`,
      [businessId, customerId],
    ),
  ])

  const stats = invoiceStats[0]
  return {
    customerId,
    customerName: customer?.name ?? '',
    totalInvoiced: stats?.total_invoiced ?? 0,
    totalPaid: stats?.total_paid ?? 0,
    outstanding: (stats?.total_invoiced ?? 0) - (stats?.total_paid ?? 0),
    invoiceCount: stats?.invoice_count ?? 0,
    lastInvoiceDate: stats?.last_date ?? null,
  }
}
