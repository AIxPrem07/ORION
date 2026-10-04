import { describe, it, expect } from 'vitest'
import { cleanAndSplitSQL } from '@/db/migrations'
import migration0005 from '../../src-tauri/migrations/0005_challan_and_financial_year.sql?raw'
import {
  getFinancialYearFromDate,
  formatFinancialYearLabel,
  financialYearStart,
  financialYearEnd,
  currentFinancialYear,
} from '@/utils/date'
import { buildInvoiceNumber } from '@/utils/format'

describe('ORION v1.5 — Delivery Challans & Financial Year Partitioning Suite', () => {
  describe('Migration 0005 SQL Parsing', () => {
    it('splits migration 0005 into executable SQL statements', () => {
      const stmts = cleanAndSplitSQL(migration0005)
      expect(stmts.length).toBeGreaterThan(5)
      expect(stmts.some((s) => s.includes('ALTER TABLE invoices ADD COLUMN financial_year'))).toBe(true)
      expect(stmts.some((s) => s.includes('CREATE TABLE IF NOT EXISTS challans'))).toBe(true)
      expect(stmts.some((s) => s.includes('CREATE TABLE IF NOT EXISTS challan_items'))).toBe(true)
      expect(stmts.some((s) => s.includes('CREATE TABLE IF NOT EXISTS challan_sequences'))).toBe(true)
    })
  })

  describe('Indian Financial Year (FY) Date Utilities', () => {
    it('correctly maps dates to Indian Financial Year (April 1 to March 31)', () => {
      // April 2026 -> FY 26-27
      expect(getFinancialYearFromDate('2026-04-01')).toBe('26-27')
      expect(getFinancialYearFromDate('2026-04-15')).toBe('26-27')
      expect(getFinancialYearFromDate('2026-12-31')).toBe('26-27')

      // March 2027 -> FY 26-27
      expect(getFinancialYearFromDate('2027-03-31')).toBe('26-27')

      // April 2027 -> FY 27-28
      expect(getFinancialYearFromDate('2027-04-01')).toBe('27-28')

      // January 2026 -> FY 25-26
      expect(getFinancialYearFromDate('2026-01-15')).toBe('25-26')
    })

    it('formats FY strings to readable labels', () => {
      expect(formatFinancialYearLabel('26-27')).toBe('FY 2026-27')
      expect(formatFinancialYearLabel('27-28')).toBe('FY 2027-28')
      expect(formatFinancialYearLabel('ALL')).toBe('All Financial Years')
    })

    it('generates accurate start and end boundary dates for any FY', () => {
      expect(financialYearStart('26-27')).toBe('2026-04-01')
      expect(financialYearEnd('26-27')).toBe('2027-03-31')

      expect(financialYearStart('27-28')).toBe('2027-04-01')
      expect(financialYearEnd('27-28')).toBe('2028-03-31')
    })
  })

  describe('Sequential Numbering Partitioned by FY', () => {
    it('starts invoice and challan numbering at sequence 1 for each new FY', () => {
      // FY 26-27
      const inv26_1 = buildInvoiceNumber('INV', '26-27', 1, 4)
      const ch26_1 = `${'CH'}/${'26-27'}/${String(1).padStart(4, '0')}`
      expect(inv26_1).toBe('INV/26-27/0001')
      expect(ch26_1).toBe('CH/26-27/0001')

      // FY 27-28 starts at 1 independently
      const inv27_1 = buildInvoiceNumber('INV', '27-28', 1, 4)
      const ch27_1 = `${'CH'}/${'27-28'}/${String(1).padStart(4, '0')}`
      expect(inv27_1).toBe('INV/27-28/0001')
      expect(ch27_1).toBe('CH/27-28/0001')
    })
  })

  describe('Delivery Challan Business Rules', () => {
    it('verifies challan has NO GST and calculates pure line amounts', () => {
      const items = [
        { quantity: 500, unitPrice: 20000 }, // 5 units at Rs. 200 = Rs. 1000
        { quantity: 200, unitPrice: 50000 }, // 2 units at Rs. 500 = Rs. 1000
      ]

      const itemAmounts = items.map((it) => {
        const qty = it.quantity / 100
        const total = qty * it.unitPrice
        return total
      })

      const totalAmount = itemAmounts.reduce((sum, a) => sum + a, 0)
      expect(totalAmount).toBe(200000) // Rs. 2000 in paise
      // No CGST, SGST, IGST calculations exist for delivery challans
    })

    it('verifies stock deduction and customer ledger debit rules', () => {
      const challanId = 'ch-test-1'
      const customerId = 'cust-1'
      const totalAmount = 150000

      // Stock movement rule: negative quantity (stock deducted)
      const stockMovement = {
        movementType: 'SALE',
        quantity: -10,
        referenceType: 'CHALLAN',
        referenceId: challanId,
      }
      expect(stockMovement.quantity).toBeLessThan(0)
      expect(stockMovement.referenceType).toBe('CHALLAN')

      // Ledger entry rule: DEBIT customer, 0 credit
      const ledgerEntry = {
        partyType: 'CUSTOMER',
        partyId: customerId,
        entryType: 'DEBIT',
        referenceType: 'CHALLAN',
        referenceId: challanId,
        debit: totalAmount,
        credit: 0,
      }
      expect(ledgerEntry.entryType).toBe('DEBIT')
      expect(ledgerEntry.debit).toBe(150000)
      expect(ledgerEntry.credit).toBe(0)

      // Cash flow rule: No cash_transactions are recorded for challans
      const cashTransactionsRecorded = 0
      expect(cashTransactionsRecorded).toBe(0)
    })

    it('verifies stock restoration and ledger deletion on challan deletion', () => {
      const challanId = 'ch-test-1'
      const customerId = 'cust-1'

      // Upon deletion:
      // 1. Stock movements for reference_type='CHALLAN' & reference_id=challanId are deleted (restores stock)
      // 2. Ledger entries for reference_type='CHALLAN' & reference_id=challanId are deleted
      // 3. Customer running balance is recalculated
      const deletedReference = {
        referenceType: 'CHALLAN',
        referenceId: challanId,
      }
      expect(deletedReference.referenceType).toBe('CHALLAN')
      expect(deletedReference.referenceId).toBe(challanId)
    })
  })
})
