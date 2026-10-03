/**
 * ORION Invoice Number Service
 * 
 * Manages invoice sequence generation with database-backed sequences.
 * 
 * Format: {PREFIX}/{FY}/{SEQUENCE}
 * Example: INV/26-27/0001
 * 
 * Design:
 * - Uses SQLite's atomic UPDATE + SELECT within a transaction
 * - UNIQUE constraint on (business_id, prefix, financial_year) as safety net
 * - No duplicate numbers even on retry
 * - Supports configurable padding (default 4 digits)
 * - Supports multiple concurrent prefixes (invoices vs. credit notes, etc.)
 */

import { dbTransaction } from '@db/client'
import { currentFinancialYear } from '@utils/date'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { buildInvoiceNumber } from '@utils/format'
import type { InvoiceSequence } from '@/types/invoice'

export interface GetNextNumberOptions {
  businessId: string
  prefix?: string
  financialYear?: string
  padding?: number
}

export interface NextInvoiceNumber {
  invoiceNumber: string   // formatted: "INV/26-27/0001"
  sequence: number        // raw number: 1
  prefix: string
  financialYear: string
}

/**
 * Atomically get the next invoice number.
 * Uses an exclusive transaction to prevent race conditions.
 * Safe for concurrent use within a single SQLite connection.
 */
export async function getNextInvoiceNumber(
  options: GetNextNumberOptions,
): Promise<NextInvoiceNumber> {
  const {
    businessId,
    prefix = 'INV',
    financialYear = currentFinancialYear(),
    padding = 4,
  } = options

  return dbTransaction(async (tx) => {
    // Find or create the sequence record
    const existing = await tx.select<{
      id: string
      current_number: number
      padding: number
    }>(
      `SELECT id, current_number, padding FROM invoice_sequences
       WHERE business_id = ? AND prefix = ? AND financial_year = ?
       LIMIT 1`,
      [businessId, prefix, financialYear],
    )

    let nextNumber: number
    let sequenceId: string
    let effectivePadding: number

    if (existing.length === 0) {
      // Create new sequence starting at 1
      sequenceId = generateId()
      nextNumber = 1
      effectivePadding = padding

      await tx.execute(
        `INSERT INTO invoice_sequences (id, business_id, prefix, financial_year, current_number, padding, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sequenceId, businessId, prefix, financialYear, 1, padding, nowISO(), nowISO()],
      )
    } else {
      // Increment existing sequence
      sequenceId = existing[0].id
      nextNumber = existing[0].current_number + 1
      effectivePadding = existing[0].padding

      await tx.execute(
        `UPDATE invoice_sequences
         SET current_number = ?, updated_at = ?
         WHERE id = ?`,
        [nextNumber, nowISO(), sequenceId],
      )
    }

    return {
      invoiceNumber: buildInvoiceNumber(prefix, financialYear, nextNumber, effectivePadding),
      sequence: nextNumber,
      prefix,
      financialYear,
    }
  })
}

/**
 * Get all sequences for a business.
 * Used in settings to show current sequence state.
 */
export async function getSequences(businessId: string): Promise<InvoiceSequence[]> {
  const { dbSelect } = await import('@db/client')
  const rows = await dbSelect<{
    id: string
    business_id: string
    prefix: string
    financial_year: string
    current_number: number
    padding: number
    created_at: string
    updated_at: string
  }>(
    `SELECT * FROM invoice_sequences WHERE business_id = ? ORDER BY financial_year DESC, prefix ASC`,
    [businessId],
  )

  return rows.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    prefix: r.prefix,
    financialYear: r.financial_year,
    currentNumber: r.current_number,
    padding: r.padding,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

/**
 * Reset a sequence (for a new financial year or correcting mistakes).
 * WARNING: Only use this carefully. Resetting to a lower number than
 * existing invoices can cause UNIQUE constraint failures on next use.
 */
export async function resetSequence(options: {
  businessId: string
  prefix: string
  financialYear: string
  newStartNumber: number
  padding: number
}): Promise<void> {
  const { dbExecute } = await import('@db/client')
  const { businessId, prefix, financialYear, newStartNumber, padding } = options

  await dbExecute(
    `INSERT INTO invoice_sequences (id, business_id, prefix, financial_year, current_number, padding, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(business_id, prefix, financial_year)
     DO UPDATE SET current_number = ?, padding = ?, updated_at = ?`,
    [
      generateId(),
      businessId,
      prefix,
      financialYear,
      newStartNumber - 1,  // -1 because getNextInvoiceNumber increments before using
      padding,
      nowISO(),
      nowISO(),
      newStartNumber - 1,
      padding,
      nowISO(),
    ],
  )
}

/**
 * Peek at the next invoice number without consuming it.
 * Used to display the upcoming number in the invoice creation form.
 */
export async function peekNextInvoiceNumber(
  options: GetNextNumberOptions,
): Promise<string> {
  const { dbSelect } = await import('@db/client')
  const {
    businessId,
    prefix = 'INV',
    financialYear = currentFinancialYear(),
    padding = 4,
  } = options

  const existing = await dbSelect<{ current_number: number; padding: number }>(
    `SELECT current_number, padding FROM invoice_sequences
     WHERE business_id = ? AND prefix = ? AND financial_year = ?
     LIMIT 1`,
    [businessId, prefix, financialYear],
  )

  if (existing.length === 0) {
    return buildInvoiceNumber(prefix, financialYear, 1, padding)
  }

  return buildInvoiceNumber(
    prefix,
    financialYear,
    existing[0].current_number + 1,
    existing[0].padding,
  )
}
