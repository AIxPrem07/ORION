/**
 * ORION Returns & Credit/Debit Notes Service
 * 
 * Handles Sales Returns (with Credit Notes) and Purchase Returns (with Debit Notes).
 * Integrates atomically with:
 * - Inventory stock movements (SALE_RETURN restores stock, PURCHASE_RETURN removes stock)
 * - Customer & Supplier Ledgers (Credit Note credits customer, Debit Note debits supplier)
 * - Audit Trail logging
 */
import { dbSelect, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { recordStockMovement } from './inventory.service'
import { createLedgerEntry } from './ledger.service'
import { getNextInvoiceNumber } from './invoice-number.service'
import { recordAuditEvent } from './audit.service'
import type {
  Return,
  ReturnItem,
  CreditNote,
  DebitNote,
  ReturnType,
  CreateSalesReturnInput,
  CreatePurchaseReturnInput,
} from '@/types/returns'

export interface ListReturnsOptions {
  businessId: string
  returnType?: ReturnType
  search?: string
  page?: number
  pageSize?: number
}

export interface ListReturnsResult {
  data: Return[]
  total: number
  page: number
  pageSize: number
}

/**
 * Creates a Sales Return, restores inventory, issues a Credit Note, and credits the customer's ledger.
 */
export async function createSalesReturn(input: CreateSalesReturnInput): Promise<{
  returnRecord: Return
  creditNote: CreditNote
}> {
  if (!input.items || input.items.length === 0) {
    throw new Error('At least one item is required to create a sales return.')
  }

  // Pre-calculate line item amounts
  let totalAmount = 0
  for (const item of input.items) {
    if (item.quantity <= 0) {
      throw new Error('Item quantity must be greater than zero.')
    }
    // item.quantity is scaled x100, unitPrice is in paise
    // line total in paise = (unitPrice * quantity) / 100
    const lineTotal = Math.round((item.unitPrice * item.quantity) / 100)
    totalAmount += lineTotal
  }

  return dbTransaction(async (tx) => {
    // 1. Generate sequence numbers
    const returnSeq = await getNextInvoiceNumber({
      businessId: input.businessId,
      prefix: 'SR',
    })
    const creditNoteSeq = await getNextInvoiceNumber({
      businessId: input.businessId,
      prefix: 'CN',
    })

    const returnId = generateId()
    const creditNoteId = generateId()
    const now = nowISO()

    // 2. Insert Return header
    await tx.execute(
      `INSERT INTO returns
       (id, business_id, return_type, return_number, original_invoice_id, original_purchase_id, party_id, return_date, status, total_amount, notes, created_at, updated_at)
       VALUES (?, ?, 'SALE_RETURN', ?, ?, NULL, ?, ?, 'COMPLETED', ?, ?, ?, ?)`,
      [
        returnId,
        input.businessId,
        returnSeq.invoiceNumber,
        input.originalInvoiceId ?? null,
        input.customerId,
        input.returnDate,
        totalAmount,
        input.notes ?? input.reason ?? null,
        now,
        now,
      ],
    )

    // 3. Insert Return items and record inventory movement
    const returnItems: ReturnItem[] = []
    for (const item of input.items) {
      const lineTotal = Math.round((item.unitPrice * item.quantity) / 100)
      const itemId = generateId()

      await tx.execute(
        `INSERT INTO return_items
         (id, return_id, product_id, quantity, unit_price, total_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, returnId, item.productId, item.quantity, item.unitPrice, lineTotal, now],
      )

      returnItems.push({
        id: itemId,
        returnId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: lineTotal,
        createdAt: now,
      })

      // Increase stock back into inventory (positive quantity for SALE_RETURN)
      await recordStockMovement(
        {
          businessId: input.businessId,
          productId: item.productId,
          movementType: 'SALE_RETURN',
          quantity: item.quantity,
          referenceType: 'RETURN',
          referenceId: returnId,
          notes: `Sales Return ${returnSeq.invoiceNumber}`,
        },
        tx,
      )
    }

    // 4. Issue Credit Note
    await tx.execute(
      `INSERT INTO credit_notes
       (id, business_id, credit_note_number, customer_id, return_id, invoice_id, issue_date, amount, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', ?, ?)`,
      [
        creditNoteId,
        input.businessId,
        creditNoteSeq.invoiceNumber,
        input.customerId,
        returnId,
        input.originalInvoiceId ?? null,
        input.returnDate,
        totalAmount,
        input.reason ?? 'Sales Return',
        now,
        now,
      ],
    )

    // 5. Update Customer Ledger (CREDIT customer, reducing receivable)
    await createLedgerEntry(
      {
        businessId: input.businessId,
        entryDate: input.returnDate,
        partyType: 'CUSTOMER',
        partyId: input.customerId,
        referenceType: 'CREDIT_NOTE',
        referenceId: creditNoteId,
        description: `Credit Note ${creditNoteSeq.invoiceNumber} for Return ${returnSeq.invoiceNumber}`,
        debit: 0,
        credit: totalAmount,
      },
      tx,
    )

    // 6. Audit Trail
    await recordAuditEvent({
      businessId: input.businessId,
      action: 'CREATED',
      entityType: 'RETURN',
      entityId: returnId,
      newValues: {
        returnNumber: returnSeq.invoiceNumber,
        creditNoteNumber: creditNoteSeq.invoiceNumber,
        totalAmount,
        customerId: input.customerId,
      },
    })

    const returnRecord: Return = {
      id: returnId,
      businessId: input.businessId,
      returnType: 'SALE_RETURN',
      returnNumber: returnSeq.invoiceNumber,
      originalInvoiceId: input.originalInvoiceId ?? null,
      partyId: input.customerId,
      returnDate: input.returnDate,
      status: 'COMPLETED',
      totalAmount,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
      items: returnItems,
      creditNoteId,
      creditNoteNumber: creditNoteSeq.invoiceNumber,
    }

    const creditNote: CreditNote = {
      id: creditNoteId,
      businessId: input.businessId,
      creditNoteNumber: creditNoteSeq.invoiceNumber,
      customerId: input.customerId,
      returnId,
      invoiceId: input.originalInvoiceId ?? null,
      issueDate: input.returnDate,
      amount: totalAmount,
      reason: input.reason ?? null,
      status: 'ISSUED',
      createdAt: now,
      updatedAt: now,
    }

    return { returnRecord, creditNote }
  })
}

/**
 * Creates a Purchase Return, deducts inventory, issues a Debit Note, and debits the supplier's ledger.
 */
export async function createPurchaseReturn(input: CreatePurchaseReturnInput): Promise<{
  returnRecord: Return
  debitNote: DebitNote
}> {
  if (!input.items || input.items.length === 0) {
    throw new Error('At least one item is required to create a purchase return.')
  }

  let totalAmount = 0
  for (const item of input.items) {
    if (item.quantity <= 0) {
      throw new Error('Item quantity must be greater than zero.')
    }
    const lineTotal = Math.round((item.unitPrice * item.quantity) / 100)
    totalAmount += lineTotal
  }

  return dbTransaction(async (tx) => {
    const returnSeq = await getNextInvoiceNumber({
      businessId: input.businessId,
      prefix: 'PR',
    })
    const debitNoteSeq = await getNextInvoiceNumber({
      businessId: input.businessId,
      prefix: 'DN',
    })

    const returnId = generateId()
    const debitNoteId = generateId()
    const now = nowISO()

    // 1. Insert Return header
    await tx.execute(
      `INSERT INTO returns
       (id, business_id, return_type, return_number, original_invoice_id, original_purchase_id, party_id, return_date, status, total_amount, notes, created_at, updated_at)
       VALUES (?, ?, 'PURCHASE_RETURN', ?, NULL, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)`,
      [
        returnId,
        input.businessId,
        returnSeq.invoiceNumber,
        input.originalPurchaseId ?? null,
        input.supplierId,
        input.returnDate,
        totalAmount,
        input.notes ?? input.reason ?? null,
        now,
        now,
      ],
    )

    // 2. Insert items and deduct stock
    const returnItems: ReturnItem[] = []
    for (const item of input.items) {
      const lineTotal = Math.round((item.unitPrice * item.quantity) / 100)
      const itemId = generateId()

      await tx.execute(
        `INSERT INTO return_items
         (id, return_id, product_id, quantity, unit_price, total_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, returnId, item.productId, item.quantity, item.unitPrice, lineTotal, now],
      )

      returnItems.push({
        id: itemId,
        returnId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: lineTotal,
        createdAt: now,
      })

      // Deduct stock from inventory (negative quantity for PURCHASE_RETURN)
      await recordStockMovement(
        {
          businessId: input.businessId,
          productId: item.productId,
          movementType: 'PURCHASE_RETURN',
          quantity: -item.quantity,
          referenceType: 'RETURN',
          referenceId: returnId,
          notes: `Purchase Return ${returnSeq.invoiceNumber}`,
        },
        tx,
      )
    }

    // 3. Issue Debit Note
    await tx.execute(
      `INSERT INTO debit_notes
       (id, business_id, debit_note_number, supplier_id, return_id, purchase_id, issue_date, amount, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', ?, ?)`,
      [
        debitNoteId,
        input.businessId,
        debitNoteSeq.invoiceNumber,
        input.supplierId,
        returnId,
        input.originalPurchaseId ?? null,
        input.returnDate,
        totalAmount,
        input.reason ?? 'Purchase Return',
        now,
        now,
      ],
    )

    // 4. Update Supplier Ledger (DEBIT supplier, reducing our payable)
    await createLedgerEntry(
      {
        businessId: input.businessId,
        entryDate: input.returnDate,
        partyType: 'SUPPLIER',
        partyId: input.supplierId,
        referenceType: 'DEBIT_NOTE',
        referenceId: debitNoteId,
        description: `Debit Note ${debitNoteSeq.invoiceNumber} for Return ${returnSeq.invoiceNumber}`,
        debit: totalAmount,
        credit: 0,
      },
      tx,
    )

    // 5. Audit Trail
    await recordAuditEvent({
      businessId: input.businessId,
      action: 'CREATED',
      entityType: 'RETURN',
      entityId: returnId,
      newValues: {
        returnNumber: returnSeq.invoiceNumber,
        debitNoteNumber: debitNoteSeq.invoiceNumber,
        totalAmount,
        supplierId: input.supplierId,
      },
    })

    const returnRecord: Return = {
      id: returnId,
      businessId: input.businessId,
      returnType: 'PURCHASE_RETURN',
      returnNumber: returnSeq.invoiceNumber,
      originalPurchaseId: input.originalPurchaseId ?? null,
      partyId: input.supplierId,
      returnDate: input.returnDate,
      status: 'COMPLETED',
      totalAmount,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
      items: returnItems,
      debitNoteId,
      debitNoteNumber: debitNoteSeq.invoiceNumber,
    }

    const debitNote: DebitNote = {
      id: debitNoteId,
      businessId: input.businessId,
      debitNoteNumber: debitNoteSeq.invoiceNumber,
      supplierId: input.supplierId,
      returnId,
      purchaseId: input.originalPurchaseId ?? null,
      issueDate: input.returnDate,
      amount: totalAmount,
      reason: input.reason ?? null,
      status: 'ISSUED',
      createdAt: now,
      updatedAt: now,
    }

    return { returnRecord, debitNote }
  })
}

/**
 * List returns with party names and associated credit/debit notes.
 */
export async function listReturns(options: ListReturnsOptions): Promise<ListReturnsResult> {
  const { businessId, returnType, search, page = 1, pageSize = 50 } = options
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['r.business_id = ?']
  const params: unknown[] = [businessId]

  if (returnType) {
    conditions.push('r.return_type = ?')
    params.push(returnType)
  }

  if (search?.trim()) {
    conditions.push(
      '(r.return_number LIKE ? OR c.name LIKE ? OR s.name LIKE ? OR cn.credit_note_number LIKE ? OR dn.debit_note_number LIKE ?)',
    )
    const term = `%${search.trim()}%`
    params.push(term, term, term, term, term)
  }

  const whereClause = conditions.join(' AND ')

  const countRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(r.id) as count
     FROM returns r
     LEFT JOIN customers c ON r.party_id = c.id
     LEFT JOIN suppliers s ON r.party_id = s.id
     LEFT JOIN credit_notes cn ON r.id = cn.return_id
     LEFT JOIN debit_notes dn ON r.id = dn.return_id
     WHERE ${whereClause}`,
    params,
  )
  const total = countRows[0]?.count ?? 0

  const rows = await dbSelect<any>(
    `SELECT r.*,
            COALESCE(c.name, s.name, 'Unknown') as party_name,
            cn.id as credit_note_id,
            cn.credit_note_number,
            dn.id as debit_note_id,
            dn.debit_note_number
     FROM returns r
     LEFT JOIN customers c ON r.party_id = c.id
     LEFT JOIN suppliers s ON r.party_id = s.id
     LEFT JOIN credit_notes cn ON r.id = cn.return_id
     LEFT JOIN debit_notes dn ON r.id = dn.return_id
     WHERE ${whereClause}
     ORDER BY r.return_date DESC, r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )

  const data: Return[] = rows.map((r: any) => ({
    id: r.id,
    businessId: r.business_id,
    returnType: r.return_type,
    returnNumber: r.return_number,
    originalInvoiceId: r.original_invoice_id,
    originalPurchaseId: r.original_purchase_id,
    partyId: r.party_id,
    partyName: r.party_name,
    returnDate: r.return_date,
    status: r.status,
    totalAmount: r.total_amount,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    creditNoteId: r.credit_note_id,
    creditNoteNumber: r.credit_note_number,
    debitNoteId: r.debit_note_id,
    debitNoteNumber: r.debit_note_number,
  }))

  return { data, total, page, pageSize }
}

/**
 * List all Credit Notes.
 */
export async function listCreditNotes(businessId: string): Promise<CreditNote[]> {
  const rows = await dbSelect<any>(
    `SELECT cn.*, c.name as customer_name, inv.invoice_number
     FROM credit_notes cn
     LEFT JOIN customers c ON cn.customer_id = c.id
     LEFT JOIN invoices inv ON cn.invoice_id = inv.id
     WHERE cn.business_id = ?
     ORDER BY cn.issue_date DESC, cn.created_at DESC`,
    [businessId],
  )

  return rows.map((r: any) => ({
    id: r.id,
    businessId: r.business_id,
    creditNoteNumber: r.credit_note_number,
    customerId: r.customer_id,
    customerName: r.customer_name,
    returnId: r.return_id,
    invoiceId: r.invoice_id,
    invoiceNumber: r.invoice_number,
    issueDate: r.issue_date,
    amount: r.amount,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

/**
 * List all Debit Notes.
 */
export async function listDebitNotes(businessId: string): Promise<DebitNote[]> {
  const rows = await dbSelect<any>(
    `SELECT dn.*, s.name as supplier_name, p.purchase_number
     FROM debit_notes dn
     LEFT JOIN suppliers s ON dn.supplier_id = s.id
     LEFT JOIN purchases p ON dn.purchase_id = p.id
     WHERE dn.business_id = ?
     ORDER BY dn.issue_date DESC, dn.created_at DESC`,
    [businessId],
  )

  return rows.map((r: any) => ({
    id: r.id,
    businessId: r.business_id,
    debitNoteNumber: r.debit_note_number,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    returnId: r.return_id,
    purchaseId: r.purchase_id,
    purchaseNumber: r.purchase_number,
    issueDate: r.issue_date,
    amount: r.amount,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}
