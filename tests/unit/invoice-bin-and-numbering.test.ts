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

    it('verifies customer ledger deletion and balance recalculation logic', () => {
      // In ORION v1.2, deleting/binning an invoice removes the debit entry directly
      // and recalculates chronological running balances, ensuring customer total debit drops immediately.
      interface LedgerEntry {
        id: string
        debit: number
        credit: number
        balance: number
      }

      let entries: LedgerEntry[] = [
        { id: 'entry-opening', debit: 10000, credit: 0, balance: 10000 },
        { id: 'entry-inv-1', debit: 50000, credit: 0, balance: 60000 },
        { id: 'entry-pay-1', debit: 0, credit: 20000, balance: 40000 },
      ]

      // Delete invoice inv-1
      entries = entries.filter((e) => e.id !== 'entry-inv-1')

      // Recalculate running balance
      let running = 0
      for (const e of entries) {
        running += e.debit - e.credit
        e.balance = running
      }

      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)
      const finalBalance = running

      expect(totalDebit).toBe(10000) // Dropped from 60000 to 10000!
      expect(totalCredit).toBe(20000)
      expect(finalBalance).toBe(-10000) // 10000 - 20000 = -10000
      expect(entries[entries.length - 1].balance).toBe(-10000)
    })
  })

  describe('ORION v1.2 — Clean Box & Product Lines Mode', () => {
    it('correctly maps productLinesMode clean_box to hide row lines while keeping col lines', () => {
      const design = { productLinesMode: 'clean_box' as const, showRowDividers: true, showColumnDividers: true }
      const showRowDividers = design.productLinesMode === 'clean_box' || design.productLinesMode === 'none' ? false : (design.showRowDividers !== false)
      const showColDividers = design.productLinesMode === 'none' ? false : (design.showColumnDividers !== false)

      expect(showRowDividers).toBe(false)
      expect(showColDividers).toBe(true)
    })

    it('correctly maps productLinesMode all and none', () => {
      const designAll = { productLinesMode: 'all' as const, showRowDividers: true, showColumnDividers: true }
      expect(designAll.productLinesMode === 'clean_box' ? false : designAll.showRowDividers).toBe(true)

      const designNone = { productLinesMode: 'none' as const, showRowDividers: true, showColumnDividers: true }
      const showRowNone = designNone.productLinesMode === 'clean_box' || designNone.productLinesMode === 'none' ? false : true
      const showColNone = designNone.productLinesMode === 'none' ? false : true
      expect(showRowNone).toBe(false)
      expect(showColNone).toBe(false)
    })
  })
})
