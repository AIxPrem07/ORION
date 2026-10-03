/**
 * ORION Payment Service
 * Records payments and allocates them to invoices/purchases.
 * Updates ledger and payment status atomically.
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO, todayISO } from '@utils/date'
import { recordAuditEvent } from './audit.service'
import { createLedgerEntry } from './ledger.service'
import type { Payment, PaymentFormData, PaymentAllocation } from '@/types/payment'
import type { Invoice } from '@/types/invoice'
import { rupeesToPaise } from '@utils/decimal'

export interface RecordPaymentInput {
  businessId: string
  paymentType: 'RECEIPT' | 'PAYMENT'
  partyType: 'CUSTOMER' | 'SUPPLIER'
  partyId: string
  partyName: string
  paymentDate: string
  amount: number   // in paise
  method: string
  referenceNumber?: string
  notes?: string
  allocations?: Array<{ invoiceId?: string; purchaseId?: string; amount: number }>
  createdBy?: string
}

export async function recordPayment(input: RecordPaymentInput): Promise<Payment> {
  const paymentId = generateId()
  const now = nowISO()

  await dbTransaction(async (tx) => {
    // Insert payment record
    await tx.execute(
      `INSERT INTO payments (id, business_id, payment_type, party_type, party_id, payment_date, amount, method, reference_number, notes, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)`,
      [paymentId, input.businessId, input.paymentType, input.partyType, input.partyId, input.paymentDate, input.amount, input.method, input.referenceNumber ?? null, input.notes ?? null, input.createdBy ?? null, now, now],
    )

    // Process allocations
    for (const alloc of (input.allocations ?? [])) {
      if (alloc.amount <= 0) continue
      const allocId = generateId()
      await tx.execute(
        `INSERT INTO payment_allocations (id, payment_id, invoice_id, purchase_id, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [allocId, paymentId, alloc.invoiceId ?? null, alloc.purchaseId ?? null, alloc.amount, now],
      )

      // Update invoice paid_amount and payment_status
      if (alloc.invoiceId) {
        await tx.execute(
          `UPDATE invoices SET
             paid_amount = paid_amount + ?,
             payment_status = CASE
               WHEN paid_amount + ? >= total_amount THEN 'PAID'
               WHEN paid_amount + ? > 0 THEN 'PARTIALLY_PAID'
               ELSE 'UNPAID'
             END,
             status = CASE
               WHEN status IN ('FINALIZED', 'PARTIALLY_PAID') AND paid_amount + ? >= total_amount THEN 'PAID'
               WHEN status = 'FINALIZED' AND paid_amount + ? > 0 THEN 'PARTIALLY_PAID'
               ELSE status
             END,
             updated_at = ?
           WHERE id = ?`,
          [alloc.amount, alloc.amount, alloc.amount, alloc.amount, alloc.amount, now, alloc.invoiceId],
        )
      }

      // Update purchase paid_amount and payment_status
      if (alloc.purchaseId) {
        await tx.execute(
          `UPDATE purchases SET
             paid_amount = paid_amount + ?,
             payment_status = CASE
               WHEN paid_amount + ? >= total_amount THEN 'PAID'
               WHEN paid_amount + ? > 0 THEN 'PARTIALLY_PAID'
               ELSE 'UNPAID'
             END,
             status = CASE
               WHEN status IN ('RECEIVED', 'CONFIRMED', 'PARTIALLY_PAID') AND paid_amount + ? >= total_amount THEN 'PAID'
               WHEN status IN ('RECEIVED', 'CONFIRMED') AND paid_amount + ? > 0 THEN 'PARTIALLY_PAID'
               ELSE status
             END,
             updated_at = ?
           WHERE id = ?`,
          [alloc.amount, alloc.amount, alloc.amount, alloc.amount, alloc.amount, now, alloc.purchaseId],
        )
      }
    }

    // Create ledger entry
    const isReceipt = input.paymentType === 'RECEIPT'
    await createLedgerEntry({
      businessId: input.businessId,
      entryDate: input.paymentDate,
      partyType: input.partyType,
      partyId: input.partyId,
      referenceType: 'PAYMENT',
      referenceId: paymentId,
      description: `${isReceipt ? 'Payment received from' : 'Payment made to'} ${input.partyName} via ${input.method}${input.referenceNumber ? ` (Ref: ${input.referenceNumber})` : ''}`,
      debit: isReceipt ? 0 : input.amount,
      credit: isReceipt ? input.amount : 0,
    }, tx)
  })

  await recordAuditEvent({
    businessId: input.businessId,
    userId: input.createdBy,
    action: 'PAYMENT_RECORDED',
    entityType: 'PAYMENT',
    entityId: paymentId,
    newValues: { amount: input.amount, method: input.method, partyId: input.partyId },
  })

  const rows = await dbSelect<Record<string, unknown>>(`SELECT * FROM payments WHERE id = ?`, [paymentId])
  return rows[0] as unknown as Payment
}

export interface RecordInvoicePaymentInput {
  businessId: string
  invoiceId: string
  amount: number   // in paise
  paymentDate?: string
  method?: string
  referenceNumber?: string
  notes?: string
  createdBy?: string
}

/**
 * Record a payment specifically for an invoice, updating invoice status and customer ledger.
 */
export async function recordInvoicePayment(input: RecordInvoicePaymentInput): Promise<{ payment: Payment; invoice: Invoice }> {
  const invRows = await dbSelect<Record<string, unknown>>(`SELECT * FROM invoices WHERE id = ?`, [input.invoiceId])
  if (invRows.length === 0) throw new Error('Invoice not found')
  const rawInvoice = invRows[0]
  if (rawInvoice.status === 'CANCELLED') throw new Error('Cannot record payment for a cancelled invoice.')
  if (rawInvoice.status === 'DRAFT') throw new Error('Cannot record payment for a draft invoice. Please finalize the invoice first.')

  const customerSnapshot = JSON.parse((rawInvoice.customer_snapshot as string) || '{}')
  const partyName = customerSnapshot.name || 'Walk-in Customer'
  const partyId = (rawInvoice.customer_id as string) || 'walk-in'
  const dateToUse = input.paymentDate || todayISO()

  const payment = await recordPayment({
    businessId: input.businessId,
    paymentType: 'RECEIPT',
    partyType: 'CUSTOMER',
    partyId,
    partyName,
    paymentDate: dateToUse,
    amount: input.amount,
    method: input.method || 'CASH',
    referenceNumber: input.referenceNumber,
    notes: input.notes,
    allocations: [{ invoiceId: input.invoiceId, amount: input.amount }],
    createdBy: input.createdBy,
  })

  const updatedInvRows = await dbSelect<Record<string, unknown>>(`SELECT * FROM invoices WHERE id = ?`, [input.invoiceId])
  return { payment, invoice: updatedInvRows[0] as unknown as Invoice }
}

export interface RecordPurchasePaymentInput {
  businessId: string
  purchaseId: string
  amount: number   // in paise
  paymentDate?: string
  method?: string
  referenceNumber?: string
  notes?: string
  createdBy?: string
}

/**
 * Record a payment specifically for a purchase, updating purchase status and supplier ledger.
 */
export async function recordPurchasePayment(input: RecordPurchasePaymentInput): Promise<{ payment: Payment }> {
  const purRows = await dbSelect<Record<string, unknown>>(`SELECT * FROM purchases WHERE id = ?`, [input.purchaseId])
  if (purRows.length === 0) throw new Error('Purchase not found')
  const purchase = purRows[0]

  const supplierRows = await dbSelect<{ name: string }>(`SELECT name FROM suppliers WHERE id = ?`, [purchase.supplier_id])
  const partyName = supplierRows[0]?.name || 'Supplier'
  const dateToUse = input.paymentDate || todayISO()

  const payment = await recordPayment({
    businessId: input.businessId,
    paymentType: 'PAYMENT',
    partyType: 'SUPPLIER',
    partyId: (purchase.supplier_id as string) || 'supplier',
    partyName,
    paymentDate: dateToUse,
    amount: input.amount,
    method: input.method || 'BANK_TRANSFER',
    referenceNumber: input.referenceNumber,
    notes: input.notes,
    allocations: [{ purchaseId: input.purchaseId, amount: input.amount }],
    createdBy: input.createdBy,
  })

  return { payment }
}
