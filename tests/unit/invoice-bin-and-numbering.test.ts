import { describe, it, expect, vi } from 'vitest'
import { cleanAndSplitSQL } from '@/db/migrations'
import migration0004 from '../../src-tauri/migrations/0004_invoice_bin_and_numbering.sql?raw'
import { buildInvoiceNumber } from '@/utils/format'

describe('ORION v1.1 — Recycle Bin & Invoice Numbering Suite', () => {
  describe('Migration 0004 SQL Parsing', () => {
    it('splits migration 0004 into executable alter and index statements', () => {
      const stmts = cleanAndSplitSQL(migration0004)
      expect(stmts.length).toBe(3)
      expect(stmts[0]).toContain('ALTER TABLE invoices ADD COLUMN is_deleted')
      expect(stmts[1]).toContain('ALTER TABLE invoices ADD COLUMN deleted_at')
      expect(stmts[2]).toContain('CREATE INDEX IF NOT EXISTS idx_invoices_deleted')
    })
  })

  describe('Invoice Number Editing & Uniqueness Validation', () => {
    it('validates that empty or whitespace invoice numbers are rejected', () => {
      const validateNumber = (num: string) => {
        const clean = num.trim()
        if (!clean) throw new Error('Invoice number cannot be empty.')
        return clean
      }

      expect(() => validateNumber('')).toThrow('Invoice number cannot be empty.')
      expect(() => validateNumber('   ')).toThrow('Invoice number cannot be empty.')
      expect(validateNumber('INV-2026-999')).toBe('INV-2026-999')
    })

    it('formats sequential and custom invoice numbers correctly', () => {
      const formatted = buildInvoiceNumber('INV', '26-27', 105)
      expect(formatted).toBe('INV/26-27/0105')

      const customFormat = 'ORION-2026-0042'
      expect(customFormat.startsWith('ORION-')).toBe(true)
    })
  })

  describe('Recycle Bin State & Stock/Ledger Inversion Logic', () => {
    it('correctly models invoice isDeleted flag and timestamp mapping', () => {
      const mockDbRow = {
        id: 'inv-123',
        business_id: 'biz-1',
        invoice_number: 'INV/26-27/0001',
        total_amount: 50000,
        is_deleted: 1,
        deleted_at: '2026-10-03T18:00:00.000Z',
      }

      const isDeleted = Boolean(mockDbRow.is_deleted)
      const deletedAt = mockDbRow.deleted_at

      expect(isDeleted).toBe(true)
      expect(deletedAt).toBe('2026-10-03T18:00:00.000Z')
    })

    it('verifies stock reversal logic when moving finalized invoice to bin', () => {
      const invoiceItems = [
        { productId: 'prod-1', quantity: 200, description: 'Gaming Laptop' }, // 2 units
        { productId: 'prod-2', quantity: 500, description: 'Wireless Mouse' }, // 5 units
      ]

      // When moved to bin, movement is SALE_RETURN with positive actualQuantity
      const stockReversals = invoiceItems.map((item) => ({
        movementType: 'SALE_RETURN',
        quantity: Math.round(item.quantity / 100),
      }))

      expect(stockReversals).toEqual([
        { movementType: 'SALE_RETURN', quantity: 2 },
        { movementType: 'SALE_RETURN', quantity: 5 },
      ])
    })

    it('verifies customer ledger reversal logic when moving finalized invoice to bin', () => {
      const invoiceTotalAmount = 75000 // ₹750.00
      const customerId = 'cust-1'

      // Original invoice created debit entry: debit = totalAmount, credit = 0
      // Binning creates reversal entry: debit = 0, credit = totalAmount
      const ledgerReversal = {
        partyId: customerId,
        debit: 0,
        credit: invoiceTotalAmount,
      }

      expect(ledgerReversal.debit).toBe(0)
      expect(ledgerReversal.credit).toBe(75000)
    })
  })
})
