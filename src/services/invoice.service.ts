/**
 * ORION Invoice Service
 * 
 * Complete invoice lifecycle management:
 * DRAFT → FINALIZED → PAID | PARTIALLY_PAID | CANCELLED
 * 
 * All state transitions happen within database transactions.
 * Invoice finalization atomically:
 *   1. Assigns invoice number
 *   2. Updates stock for all items
 *   3. Creates ledger entry
 *   4. Updates invoice status
 */

import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO, todayISO } from '@utils/date'
import { normalizeError } from '@utils/error'
import { calculateInvoiceTotals } from './gst.service'
import { getNextInvoiceNumber } from './invoice-number.service'
import { recordStockMovement } from './inventory.service'
import { createLedgerEntry } from './ledger.service'
import { recordAuditEvent } from './audit.service'
import { customerToSnapshot } from './customer.service'
import type { Invoice, InvoiceWithItems, InvoiceItem, InvoiceFormData, InvoiceTotals } from '@/types/invoice'
import type { Customer } from '@/types/customer'
import { quantityToInt, rupeesToPaise } from '@utils/decimal'

// ============================================================
// TYPE MAPPING
// ============================================================

function rowToInvoice(r: Record<string, unknown>): Invoice {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    invoiceNumber: r.invoice_number as string,
    customerId: r.customer_id as string | null,
    customerSnapshot: JSON.parse(r.customer_snapshot as string || '{}'),
    invoiceDate: r.invoice_date as string,
    dueDate: r.due_date as string | null,
    status: r.status as Invoice['status'],
    paymentStatus: r.payment_status as Invoice['paymentStatus'],
    supplyType: r.supply_type as Invoice['supplyType'],
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
    termsAndConditions: r.terms_and_conditions as string | null,
    paymentMethod: r.payment_method as string | null,
    createdBy: r.created_by as string | null,
    cancelledAt: r.cancelled_at as string | null,
    cancelledReason: r.cancelled_reason as string | null,
    // Shipping Address
    shippingName: (r.shipping_name as string) ?? null,
    shippingAddress: (r.shipping_address as string) ?? null,
    shippingCity: (r.shipping_city as string) ?? null,
    shippingState: (r.shipping_state as string) ?? null,
    shippingStateCode: (r.shipping_state_code as string) ?? null,
    shippingPin: (r.shipping_pin as string) ?? null,
    // Vehicle & Transport Details
    vehicleNumber: (r.vehicle_number as string) ?? null,
    transportMode: (r.transport_mode as string) ?? null,
    transporterName: (r.transporter_name as string) ?? null,
    transporterId: (r.transporter_id as string) ?? null,
    lrRrNumber: (r.lr_rr_number as string) ?? null,
    lrRrDate: (r.lr_rr_date as string) ?? null,
    // Additional Charges
    shippingCharges: (r.shipping_charges as number) ?? 0,
    additionalCharges: (r.additional_charges as number) ?? 0,
    additionalChargesLabel: (r.additional_charges_label as string) ?? null,
    // Recycle Bin
    isDeleted: Boolean(r.is_deleted),
    deletedAt: (r.deleted_at as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToInvoiceItem(r: Record<string, unknown>): InvoiceItem {
  return {
    id: r.id as string,
    invoiceId: r.invoice_id as string,
    productId: r.product_id as string | null,
    productSnapshot: JSON.parse(r.product_snapshot as string || '{}'),
    lineNumber: r.line_number as number,
    description: r.description as string,
    hsnCode: r.hsn_code as string | null,
    quantity: r.quantity as number,
    unit: r.unit as string | null,
    purchasePrice: r.purchase_price as number,
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

// ============================================================
// CREATE DRAFT INVOICE
// ============================================================

export interface CreateInvoiceInput {
  businessId: string
  customer: Customer | null
  formData: {
    invoiceDate: string
    dueDate?: string | null
    supplyType: 'INTRASTATE' | 'INTERSTATE'
    notes?: string
    termsAndConditions?: string
    paymentMethod?: string
    // Shipping Address
    shippingName?: string | null
    shippingAddress?: string | null
    shippingCity?: string | null
    shippingState?: string | null
    shippingStateCode?: string | null
    shippingPin?: string | null
    // Transport Details
    vehicleNumber?: string | null
    transportMode?: string | null
    transporterName?: string | null
    transporterId?: string | null
    lrRrNumber?: string | null
    lrRrDate?: string | null
    // Additional Charges
    shippingCharges?: number
    overallDiscount?: number
    additionalCharges?: number
    additionalChargesLabel?: string | null
  }
  items: Array<{
    productId: string | null
    productSnapshot: Record<string, unknown>
    description: string
    hsnCode: string
    quantity: number      // already in integer × 100 form
    unit: string
    purchasePrice: number // paise
    unitPrice: number     // paise
    discountPercent: number // basis points
    taxRate: number       // basis points
  }>
  gstInclusive?: boolean
  createdBy?: string
}

/**
 * Create a new draft invoice.
 * Does NOT consume an invoice number or affect stock.
 */
export async function createDraftInvoice(input: CreateInvoiceInput): Promise<InvoiceWithItems> {
  const id = generateId()
  const now = nowISO()

  // Calculate all GST amounts
  const gstInput = {
    supplyType: input.formData.supplyType,
    gstInclusive: input.gstInclusive ?? false,
    shippingCharges: input.formData.shippingCharges ?? 0,
    overallDiscount: input.formData.overallDiscount ?? 0,
    additionalCharges: input.formData.additionalCharges ?? 0,
    lines: input.items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
      supplyType: input.formData.supplyType,
      gstInclusive: input.gstInclusive ?? false,
    })),
  }
  const totals = calculateInvoiceTotals(gstInput)

  const customerSnapshot = input.customer
    ? customerToSnapshot(input.customer)
    : { id: '', name: 'Walk-in Customer', phone: null, email: null, address: null, city: null, state: null, stateCode: null, pin: null, gstin: null, pan: null }

  await dbTransaction(async (tx) => {
    // Insert invoice (DRAFT - no invoice number assigned yet)
    await tx.execute(
      `INSERT INTO invoices (
        id, business_id, invoice_number, customer_id, customer_snapshot,
        invoice_date, due_date, status, payment_status, supply_type,
        subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount,
        igst_amount, total_tax, round_off, total_amount, paid_amount,
        notes, terms_and_conditions, payment_method, created_by,
        shipping_name, shipping_address, shipping_city, shipping_state, shipping_state_code, shipping_pin,
        vehicle_number, transport_mode, transporter_name, transporter_id, lr_rr_number, lr_rr_date,
        shipping_charges, additional_charges, additional_charges_label,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, 'DRAFT', 'UNPAID', ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 0,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )`,
      [
        id,
        input.businessId,
        `DRAFT-${id.slice(0, 8)}`,  // Temporary number for drafts
        input.customer?.id ?? null,
        JSON.stringify(customerSnapshot),
        input.formData.invoiceDate,
        input.formData.dueDate ?? null,
        input.formData.supplyType,
        totals.subtotal,
        totals.discountAmount,
        totals.taxableAmount,
        totals.cgstAmount,
        totals.sgstAmount,
        totals.igstAmount,
        totals.totalTax,
        totals.roundOff,
        totals.grandTotal,
        input.formData.notes ?? null,
        input.formData.termsAndConditions ?? null,
        input.formData.paymentMethod ?? null,
        input.createdBy ?? null,
        input.formData.shippingName ?? null,
        input.formData.shippingAddress ?? null,
        input.formData.shippingCity ?? null,
        input.formData.shippingState ?? null,
        input.formData.shippingStateCode ?? null,
        input.formData.shippingPin ?? null,
        input.formData.vehicleNumber ?? null,
        input.formData.transportMode ?? null,
        input.formData.transporterName ?? null,
        input.formData.transporterId ?? null,
        input.formData.lrRrNumber ?? null,
        input.formData.lrRrDate ?? null,
        totals.shippingCharges,
        totals.additionalCharges,
        input.formData.additionalChargesLabel ?? null,
        now,
        now,
      ],
    )

    // Insert all line items
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i]
      const lineResult = totals.lineResults[i]
      const itemId = generateId()

      await tx.execute(
        `INSERT INTO invoice_items (id, invoice_id, product_id, product_snapshot, line_number, description, hsn_code, quantity, unit, purchase_price, unit_price, discount_percent, discount_amount, taxable_amount, tax_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          id,
          item.productId ?? null,
          JSON.stringify(item.productSnapshot),
          i + 1,
          item.description,
          item.hsnCode || null,
          item.quantity,
          item.unit || null,
          item.purchasePrice,
          item.unitPrice,
          item.discountPercent,
          lineResult.discountAmount,
          lineResult.taxableAmount,
          item.taxRate,
          lineResult.cgstRate,
          lineResult.sgstRate,
          lineResult.igstRate,
          lineResult.cgstAmount,
          lineResult.sgstAmount,
          lineResult.igstAmount,
          lineResult.totalAmount,
          now,
        ],
      )
    }
  })

  await recordAuditEvent({
    businessId: input.businessId,
    userId: input.createdBy,
    action: 'CREATED',
    entityType: 'INVOICE',
    entityId: id,
    newValues: { status: 'DRAFT', customerId: input.customer?.id },
  })

  return getInvoiceWithItems(id) as Promise<InvoiceWithItems>
}

// ============================================================
// FINALIZE INVOICE
// ============================================================

/**
 * Finalize an invoice:
 * 1. Assign permanent invoice number (atomic)
 * 2. Deduct stock for all items
 * 3. Create customer ledger entry
 * 4. Change status from DRAFT to FINALIZED
 * 
 * This entire operation is in a single transaction.
 */
export async function finalizeInvoice(
  invoiceId: string,
  businessId: string,
  invoicePrefix = 'INV',
  createdBy?: string,
  customInvoiceNumber?: string,
): Promise<InvoiceWithItems> {
  // Get existing invoice
  const existing = await getInvoiceWithItems(invoiceId)
  if (!existing) throw new Error('Invoice not found')
  if (existing.status !== 'DRAFT') {
    throw new Error(`Cannot finalize invoice in ${existing.status} state. Only DRAFT invoices can be finalized.`)
  }

  const now = nowISO()
  let assignedNumber = ''

  await dbTransaction(async (tx) => {
    // If a custom invoice number was specified, use it; otherwise get next sequential number
    const customNum = customInvoiceNumber?.trim()
    if (customNum) {
      assignedNumber = customNum
    } else {
      const { invoiceNumber } = await getNextInvoiceNumber({ businessId, prefix: invoicePrefix })
      assignedNumber = invoiceNumber
    }

    // Verify number doesn't already exist (safety net for the UNIQUE constraint)
    const duplicateCheck = await tx.select<{ id: string }>(
      `SELECT id FROM invoices WHERE business_id = ? AND invoice_number = ? AND id != ?`,
      [businessId, assignedNumber, invoiceId],
    )
    if (duplicateCheck.length > 0) {
      throw new Error(`Invoice number "${assignedNumber}" already exists.`)
    }

    // Update invoice to FINALIZED
    await tx.execute(
      `UPDATE invoices SET invoice_number = ?, status = 'FINALIZED', updated_at = ? WHERE id = ?`,
      [assignedNumber, now, invoiceId],
    )

    // Deduct stock for each product line item
    for (const item of existing.items) {
      let productId = item.productId
      // Auto-match productId if user entered product name in description
      if (!productId && item.description && item.description.trim()) {
        const matchingProd = await tx.select<{ id: string }>(
          `SELECT id FROM products WHERE business_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
          [businessId, item.description.trim()],
        )
        if (matchingProd.length > 0) {
          productId = matchingProd[0].id
        }
      }

      if (!productId) continue

      const actualQuantity = item.quantity >= 100
        ? Math.round(item.quantity / 100)
        : (item.quantity > 0 ? item.quantity : 0)
      if (actualQuantity <= 0) continue

      const movementDate = existing.invoiceDate ? `${existing.invoiceDate}T12:00:00.000Z` : now

      await recordStockMovement({
        businessId,
        productId,
        movementType: 'SALE',
        quantity: -actualQuantity,
        referenceType: 'INVOICE',
        referenceId: invoiceId,
        notes: `Sale: ${assignedNumber} (${item.description})`,
        createdBy,
        createdAt: movementDate,
      }, tx)
    }

    // Create customer ledger entry (debit customer: they owe us)
    const customerSnapshot = existing.customerSnapshot
    if (existing.customerId) {
      await createLedgerEntry({
        businessId,
        entryDate: existing.invoiceDate,
        partyType: 'CUSTOMER',
        partyId: existing.customerId,
        referenceType: 'INVOICE',
        referenceId: invoiceId,
        description: `Invoice ${assignedNumber} — ${customerSnapshot.name}`,
        debit: existing.totalAmount,
        credit: 0,
      }, tx)
    }
  })

  await recordAuditEvent({
    businessId,
    userId: createdBy,
    action: 'FINALIZED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    newValues: { invoiceNumber: assignedNumber, status: 'FINALIZED' },
  })

  return getInvoiceWithItems(invoiceId) as Promise<InvoiceWithItems>
}

// ============================================================
// CANCEL INVOICE
// ============================================================

export async function cancelInvoice(
  invoiceId: string,
  businessId: string,
  reason: string,
  createdBy?: string,
): Promise<void> {
  const existing = await getInvoiceWithItems(invoiceId)
  if (!existing) throw new Error('Invoice not found')
  if (existing.status === 'CANCELLED') throw new Error('Invoice is already cancelled.')
  if (existing.status === 'PAID') throw new Error('Paid invoices cannot be cancelled. Create a sales return instead.')

  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `UPDATE invoices SET status = 'CANCELLED', cancelled_at = ?, cancelled_reason = ?, updated_at = ? WHERE id = ?`,
      [now, reason, now, invoiceId],
    )

    // Reverse stock if invoice was finalized
    if (existing.status === 'FINALIZED' || existing.status === 'PARTIALLY_PAID') {
      for (const item of existing.items) {
        if (!item.productId) continue
        const actualQuantity = Math.round(item.quantity / 100)
        if (actualQuantity <= 0) continue

        await recordStockMovement({
          businessId,
          productId: item.productId,
          movementType: 'SALE_RETURN',
          quantity: actualQuantity,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
          notes: `Cancellation of ${existing.invoiceNumber}: ${reason}`,
          createdBy,
        }, tx)
      }

      // Reverse ledger entry
      if (existing.customerId) {
        await createLedgerEntry({
          businessId,
          entryDate: now.slice(0, 10),
          partyType: 'CUSTOMER',
          partyId: existing.customerId,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
          description: `Cancellation of Invoice ${existing.invoiceNumber}`,
          debit: 0,
          credit: existing.totalAmount,
        }, tx)
      }
    }
  })

  await recordAuditEvent({
    businessId,
    userId: createdBy,
    action: 'CANCELLED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    newValues: { reason, cancelledAt: now },
  })
}

// ============================================================
// RECYCLE BIN & DELETE INVOICE
// ============================================================

/**
 * Moves an invoice to the Recycle Bin (Soft Delete).
 * If the invoice was finalized, automatically reverses stock deduction and ledger entries
 * so inventory counts and customer balances are not distorted while the invoice is in the bin.
 */
export async function moveInvoiceToBin(
  invoiceId: string,
  businessId: string,
  createdBy?: string,
): Promise<void> {
  const existing = await getInvoiceWithItems(invoiceId)
  if (!existing) throw new Error('Invoice not found')
  if (existing.isDeleted) throw new Error('Invoice is already in the Recycle Bin.')

  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `UPDATE invoices SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ? AND business_id = ?`,
      [now, now, invoiceId, businessId],
    )

    // Reverse stock movements if finalized so warehouse inventory isn't missing
    if (existing.status === 'FINALIZED' || existing.status === 'PARTIALLY_PAID') {
      for (const item of existing.items) {
        if (!item.productId) continue
        const actualQuantity = item.quantity >= 100
          ? Math.round(item.quantity / 100)
          : (item.quantity > 0 ? item.quantity : 0)
        if (actualQuantity <= 0) continue

        await recordStockMovement({
          businessId,
          productId: item.productId,
          movementType: 'SALE_RETURN',
          quantity: actualQuantity,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
          notes: `Moved to Bin: ${existing.invoiceNumber} (${item.description})`,
          createdBy,
          createdAt: now,
        }, tx)
      }

      // Reverse customer ledger entry
      if (existing.customerId) {
        await createLedgerEntry({
          businessId,
          entryDate: now.slice(0, 10),
          partyType: 'CUSTOMER',
          partyId: existing.customerId,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
          description: `Invoice ${existing.invoiceNumber} moved to Bin (Reversal)`,
          debit: 0,
          credit: existing.totalAmount,
        }, tx)
      }
    }
  })

  await recordAuditEvent({
    businessId,
    userId: createdBy,
    action: 'DELETED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    newValues: { inBin: true, deletedAt: now },
  })
}

/**
 * Restores an invoice from the Recycle Bin back to active invoices.
 * If previously finalized, re-deducts the stock and reinstates the customer ledger.
 */
export async function restoreInvoiceFromBin(
  invoiceId: string,
  businessId: string,
  createdBy?: string,
): Promise<void> {
  const existing = await getInvoiceWithItems(invoiceId)
  if (!existing) throw new Error('Invoice not found')
  if (!existing.isDeleted) throw new Error('Invoice is not in the Recycle Bin.')

  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `UPDATE invoices SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ? AND business_id = ?`,
      [now, invoiceId, businessId],
    )

    // Re-deduct stock if finalized
    if (existing.status === 'FINALIZED' || existing.status === 'PARTIALLY_PAID') {
      for (const item of existing.items) {
        if (!item.productId) continue
        const actualQuantity = item.quantity >= 100
          ? Math.round(item.quantity / 100)
          : (item.quantity > 0 ? item.quantity : 0)
        if (actualQuantity <= 0) continue

        await recordStockMovement({
          businessId,
          productId: item.productId,
          movementType: 'SALE',
          quantity: -actualQuantity,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
          notes: `Restored from Bin: ${existing.invoiceNumber} (${item.description})`,
          createdBy,
          createdAt: now,
        }, tx)
      }

      // Re-create ledger debit
      if (existing.customerId) {
        await createLedgerEntry({
          businessId,
          entryDate: now.slice(0, 10),
          partyType: 'CUSTOMER',
          partyId: existing.customerId,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
          description: `Invoice ${existing.invoiceNumber} restored from Bin`,
          debit: existing.totalAmount,
          credit: 0,
        }, tx)
      }
    }
  })

  await recordAuditEvent({
    businessId,
    userId: createdBy,
    action: 'RESTORED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    newValues: { inBin: false },
  })
}

/**
 * Permanently deletes an invoice and its line items from the database.
 */
export async function permanentlyDeleteInvoice(
  invoiceId: string,
  businessId: string,
  userId?: string,
): Promise<void> {
  const existing = await getInvoice(invoiceId)
  if (!existing) throw new Error('Invoice not found')

  await dbTransaction(async (tx) => {
    await tx.execute(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId])
    await tx.execute(`DELETE FROM invoices WHERE id = ? AND business_id = ?`, [invoiceId, businessId])
  })

  await recordAuditEvent({
    businessId,
    userId,
    action: 'DELETED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    newValues: { permanentlyDeleted: true, invoiceNumber: existing.invoiceNumber },
  })
}

/**
 * Empties all invoices currently in the Recycle Bin.
 */
export async function emptyInvoiceBin(
  businessId: string,
  userId?: string,
): Promise<number> {
  const binned = await dbSelect<{ id: string }>(
    `SELECT id FROM invoices WHERE business_id = ? AND COALESCE(is_deleted, 0) = 1`,
    [businessId],
  )
  if (binned.length === 0) return 0

  await dbTransaction(async (tx) => {
    for (const inv of binned) {
      await tx.execute(`DELETE FROM invoice_items WHERE invoice_id = ?`, [inv.id])
      await tx.execute(`DELETE FROM invoices WHERE id = ? AND business_id = ?`, [inv.id, businessId])
    }
  })

  await recordAuditEvent({
    businessId,
    userId,
    action: 'DELETED',
    entityType: 'INVOICE',
    entityId: businessId,
    newValues: { emptiedRecycleBin: true, count: binned.length },
  })

  return binned.length
}

/**
 * Returns the count of invoices currently in the Recycle Bin.
 */
export async function getBinInvoicesCount(businessId: string): Promise<number> {
  const res = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) as total FROM invoices WHERE business_id = ? AND COALESCE(is_deleted, 0) = 1`,
    [businessId],
  )
  return res[0]?.total ?? 0
}

/**
 * Change / Edit invoice number on an existing invoice.
 */
export async function updateInvoiceNumber(
  invoiceId: string,
  businessId: string,
  newInvoiceNumber: string,
  userId?: string,
): Promise<void> {
  const cleanNumber = newInvoiceNumber.trim()
  if (!cleanNumber) {
    throw new Error('Invoice number cannot be empty.')
  }

  const existing = await getInvoice(invoiceId)
  if (!existing) throw new Error('Invoice not found')
  if (existing.invoiceNumber === cleanNumber) return // No change

  // Check uniqueness across the business
  const duplicate = await dbSelect<{ id: string }>(
    `SELECT id FROM invoices WHERE business_id = ? AND invoice_number = ? AND id != ?`,
    [businessId, cleanNumber, invoiceId],
  )
  if (duplicate.length > 0) {
    throw new Error(`Invoice number "${cleanNumber}" is already in use by another invoice.`)
  }

  const now = nowISO()
  await dbTransaction(async (tx) => {
    await tx.execute(
      `UPDATE invoices SET invoice_number = ?, updated_at = ? WHERE id = ? AND business_id = ?`,
      [cleanNumber, now, invoiceId, businessId],
    )

    // Update references in ledger entries
    await tx.execute(
      `UPDATE ledger_entries SET description = REPLACE(description, ?, ?) WHERE business_id = ? AND reference_type = 'INVOICE' AND reference_id = ?`,
      [existing.invoiceNumber, cleanNumber, businessId, invoiceId],
    )

    // Update references in stock movements
    await tx.execute(
      `UPDATE stock_movements SET notes = REPLACE(notes, ?, ?) WHERE business_id = ? AND reference_type = 'INVOICE' AND reference_id = ?`,
      [existing.invoiceNumber, cleanNumber, businessId, invoiceId],
    )
  })

  await recordAuditEvent({
    businessId,
    userId,
    action: 'UPDATED',
    entityType: 'INVOICE',
    entityId: invoiceId,
    newValues: { oldInvoiceNumber: existing.invoiceNumber, newInvoiceNumber: cleanNumber },
  })
}

// ============================================================
// QUERIES
// ============================================================

export async function getInvoice(id: string): Promise<Invoice | null> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM invoices WHERE id = ?`, [id]
  )
  return rows.length > 0 ? rowToInvoice(rows[0]) : null
}

export async function getInvoiceWithItems(id: string): Promise<InvoiceWithItems | null> {
  const [invoiceRows, itemRows] = await Promise.all([
    dbSelect<Record<string, unknown>>(`SELECT * FROM invoices WHERE id = ?`, [id]),
    dbSelect<Record<string, unknown>>(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY line_number ASC`, [id]),
  ])
  if (invoiceRows.length === 0) return null
  return {
    ...rowToInvoice(invoiceRows[0]),
    items: itemRows.map(rowToInvoiceItem),
  }
}

export interface InvoiceListFilters {
  businessId: string
  search?: string
  customerId?: string
  status?: string
  paymentStatus?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
  inBin?: boolean
}

export async function listInvoices(
  filters: InvoiceListFilters,
): Promise<{ data: Invoice[]; total: number }> {
  const inBin = Boolean(filters.inBin)
  const conditions: string[] = ['business_id = ?', inBin ? 'COALESCE(is_deleted, 0) = 1' : 'COALESCE(is_deleted, 0) = 0']
  const params: unknown[] = [filters.businessId]

  if (filters.search) {
    conditions.push('(invoice_number LIKE ? OR json_extract(customer_snapshot, "$.name") LIKE ?)')
    const term = `%${filters.search}%`
    params.push(term, term)
  }
  if (filters.customerId) { conditions.push('customer_id = ?'); params.push(filters.customerId) }
  if (filters.status) { conditions.push('status = ?'); params.push(filters.status) }
  if (filters.paymentStatus) { conditions.push('payment_status = ?'); params.push(filters.paymentStatus) }
  if (filters.fromDate) { conditions.push('invoice_date >= ?'); params.push(filters.fromDate) }
  if (filters.toDate) { conditions.push('invoice_date <= ?'); params.push(filters.toDate) }

  const where = conditions.join(' AND ')
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT * FROM invoices WHERE ${where} ORDER BY invoice_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ),
    dbSelect<{ total: number }>(
      `SELECT COUNT(*) as total FROM invoices WHERE ${where}`,
      params,
    ),
  ])

  return { data: rows.map(rowToInvoice), total: countResult[0]?.total ?? 0 }
}

/**
 * Duplicate an existing invoice into a new DRAFT.
 * Never copies the invoice number.
 */
export async function duplicateInvoice(
  sourceId: string,
  businessId: string,
  createdBy?: string,
): Promise<InvoiceWithItems> {
  const source = await getInvoiceWithItems(sourceId)
  if (!source) throw new Error('Source invoice not found')

  const now = nowISO()
  const newId = generateId()

  await dbTransaction(async (tx) => {
    // Create new draft invoice
    await tx.execute(
      `INSERT INTO invoices (
        id, business_id, invoice_number, customer_id, customer_snapshot,
        invoice_date, due_date, status, payment_status, supply_type,
        subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount,
        igst_amount, total_tax, round_off, total_amount, paid_amount,
        notes, terms_and_conditions, payment_method, created_by,
        shipping_name, shipping_address, shipping_city, shipping_state, shipping_state_code, shipping_pin,
        vehicle_number, transport_mode, transporter_name, transporter_id, lr_rr_number, lr_rr_date,
        shipping_charges, additional_charges, additional_charges_label,
        created_at, updated_at
      )
      SELECT
        ?, business_id, ?, customer_id, customer_snapshot,
        ?, NULL, 'DRAFT', 'UNPAID', supply_type,
        subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount,
        igst_amount, total_tax, round_off, total_amount, 0,
        notes, terms_and_conditions, NULL, ?,
        shipping_name, shipping_address, shipping_city, shipping_state, shipping_state_code, shipping_pin,
        vehicle_number, transport_mode, transporter_name, transporter_id, lr_rr_number, lr_rr_date,
        shipping_charges, additional_charges, additional_charges_label,
        ?, ?
      FROM invoices WHERE id = ?`,
      [newId, `DRAFT-${newId.slice(0, 8)}`, todayISO(), createdBy ?? null, now, now, sourceId],
    )

    // Copy all line items
    for (const item of source.items) {
      await tx.execute(
        `INSERT INTO invoice_items (id, invoice_id, product_id, product_snapshot, line_number, description, hsn_code, quantity, unit, purchase_price, unit_price, discount_percent, discount_amount, taxable_amount, tax_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), newId, item.productId, JSON.stringify(item.productSnapshot),
          item.lineNumber, item.description, item.hsnCode, item.quantity, item.unit,
          item.purchasePrice, item.unitPrice, item.discountPercent, item.discountAmount,
          item.taxableAmount, item.taxRate, item.cgstRate, item.sgstRate, item.igstRate,
          item.cgstAmount, item.sgstAmount, item.igstAmount, item.totalAmount, now,
        ],
      )
    }
  })

  return getInvoiceWithItems(newId) as Promise<InvoiceWithItems>
}

// ============================================================
// DASHBOARD QUERIES
// ============================================================

export async function getDashboardStats(businessId: string, dateFrom: string, dateTo: string) {
  const [salesStats, todayInvoices, pendingPayments] = await Promise.all([
    dbSelect<{
      total_invoiced: number
      total_paid: number
      invoice_count: number
    }>(
      `SELECT
         COALESCE(SUM(total_amount), 0) as total_invoiced,
         COALESCE(SUM(paid_amount), 0) as total_paid,
         COUNT(*) as invoice_count
       FROM invoices
       WHERE business_id = ? AND invoice_date BETWEEN ? AND ? AND status != 'CANCELLED'`,
      [businessId, dateFrom, dateTo],
    ),
    dbSelect<{ count: number }>(
      `SELECT COUNT(*) as count FROM invoices WHERE business_id = ? AND invoice_date = date('now') AND status != 'CANCELLED'`,
      [businessId],
    ),
    dbSelect<{ outstanding: number; count: number }>(
      `SELECT
         COALESCE(SUM(total_amount - paid_amount), 0) as outstanding,
         COUNT(*) as count
       FROM invoices
       WHERE business_id = ? AND payment_status IN ('UNPAID', 'PARTIALLY_PAID') AND status = 'FINALIZED'`,
      [businessId],
    ),
  ])

  return {
    totalSales: salesStats[0]?.total_invoiced ?? 0,
    totalCollected: salesStats[0]?.total_paid ?? 0,
    invoiceCount: salesStats[0]?.invoice_count ?? 0,
    todayInvoices: todayInvoices[0]?.count ?? 0,
    outstandingAmount: pendingPayments[0]?.outstanding ?? 0,
    pendingInvoiceCount: pendingPayments[0]?.count ?? 0,
  }
}

/**
 * Update an existing draft invoice
 */
export async function updateDraftInvoice(
  invoiceId: string,
  businessId: string,
  input: CreateInvoiceInput,
): Promise<InvoiceWithItems> {
  const existing = await getInvoiceWithItems(invoiceId)
  if (!existing) throw new Error('Invoice not found')
  if (existing.status !== 'DRAFT') throw new Error('Only draft invoices can be updated')

  const now = nowISO()
  const customerSnapshot = input.customer ? customerToSnapshot(input.customer) : null

  const totals = calculateInvoiceTotals({
    lines: input.items.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discountPercent: i.discountPercent,
      taxRate: i.taxRate,
      supplyType: input.formData.supplyType,
    })),
    supplyType: input.formData.supplyType,
    gstInclusive: input.gstInclusive ?? true,
    shippingCharges: input.formData.shippingCharges ?? 0,
    overallDiscount: input.formData.overallDiscount ?? 0,
    additionalCharges: input.formData.additionalCharges ?? 0,
  })

  await dbTransaction(async (tx) => {
    // 1. Update invoice fields
    await tx.execute(
      `UPDATE invoices SET
        customer_id = ?, customer_snapshot = ?, invoice_date = ?, due_date = ?, supply_type = ?,
        subtotal = ?, discount_amount = ?, taxable_amount = ?, cgst_amount = ?, sgst_amount = ?,
        igst_amount = ?, total_tax = ?, round_off = ?, total_amount = ?,
        notes = ?, terms_and_conditions = ?, payment_method = ?,
        shipping_name = ?, shipping_address = ?, shipping_city = ?, shipping_state = ?, shipping_state_code = ?, shipping_pin = ?,
        vehicle_number = ?, transport_mode = ?, transporter_name = ?, transporter_id = ?, lr_rr_number = ?, lr_rr_date = ?,
        shipping_charges = ?, additional_charges = ?, additional_charges_label = ?,
        updated_at = ?
       WHERE id = ? AND business_id = ?`,
      [
        input.customer?.id ?? null,
        JSON.stringify(customerSnapshot),
        input.formData.invoiceDate,
        input.formData.dueDate ?? null,
        input.formData.supplyType,
        totals.subtotal,
        totals.discountAmount,
        totals.taxableAmount,
        totals.cgstAmount,
        totals.sgstAmount,
        totals.igstAmount,
        totals.totalTax,
        totals.roundOff,
        totals.grandTotal,
        input.formData.notes ?? null,
        input.formData.termsAndConditions ?? null,
        input.formData.paymentMethod ?? null,
        input.formData.shippingName ?? null,
        input.formData.shippingAddress ?? null,
        input.formData.shippingCity ?? null,
        input.formData.shippingState ?? null,
        input.formData.shippingStateCode ?? null,
        input.formData.shippingPin ?? null,
        input.formData.vehicleNumber ?? null,
        input.formData.transportMode ?? null,
        input.formData.transporterName ?? null,
        input.formData.transporterId ?? null,
        input.formData.lrRrNumber ?? null,
        input.formData.lrRrDate ?? null,
        totals.shippingCharges,
        totals.additionalCharges,
        input.formData.additionalChargesLabel ?? null,
        now,
        invoiceId,
        businessId,
      ],
    )

    // 2. Delete old line items
    await tx.execute(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId])

    // 3. Insert updated line items
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i]
      const lineResult = totals.lineResults[i]
      const itemId = generateId()

      await tx.execute(
        `INSERT INTO invoice_items (
          id, invoice_id, product_id, product_snapshot, line_number, description, hsn_code,
          quantity, unit, purchase_price, unit_price, discount_percent, discount_amount,
          taxable_amount, tax_rate, cgst_rate, sgst_rate, igst_rate,
          cgst_amount, sgst_amount, igst_amount, total_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          invoiceId,
          item.productId ?? null,
          item.productSnapshot ? JSON.stringify(item.productSnapshot) : null,
          i + 1,
          item.description,
          item.hsnCode,
          item.quantity,
          item.unit,
          item.purchasePrice,
          item.unitPrice,
          item.discountPercent,
          lineResult?.discountAmount ?? 0,
          lineResult?.taxableAmount ?? 0,
          item.taxRate,
          lineResult?.cgstRate ?? 0,
          lineResult?.sgstRate ?? 0,
          lineResult?.igstRate ?? 0,
          lineResult?.cgstAmount ?? 0,
          lineResult?.sgstAmount ?? 0,
          lineResult?.igstAmount ?? 0,
          lineResult?.totalAmount ?? 0,
          now,
        ],
      )
    }
  })

  return (await getInvoiceWithItems(invoiceId))!
}

/**
 * Create an invoice and immediately finalize it (deducts stock and records ledger).
 */
export async function createAndFinalizeInvoice(
  input: CreateInvoiceInput,
  invoicePrefix = 'INV',
): Promise<InvoiceWithItems> {
  const draft = await createDraftInvoice(input)
  return await finalizeInvoice(draft.id, input.businessId, invoicePrefix, input.createdBy)
}
