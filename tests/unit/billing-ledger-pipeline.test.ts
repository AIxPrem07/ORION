import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateInvoiceTotals } from '../../src/services/gst.service'
import { generateCSV, parseCSVToRows } from '../../src/services/import-export.service'
import { paiseToRupees, formatCurrency, rupeesToPaise } from '../../src/utils/decimal'
import type { InvoiceStatus, PaymentStatus } from '../../src/types/invoice'

describe('Billing, Ledger & CSV Export Pipeline Suite', () => {

  describe('1. Statutory GST Invoice Calculation Engine', () => {
    it('calculates Intrastate (CGST 9% + SGST 9%) tax-inclusive invoice totals correctly', () => {
      // 5 units of ₹320.00 each (tax inclusive at 18%)
      // Total Gross = ₹1,600.00 = 160000 paise
      const gstInput = {
        supplyType: 'INTRASTATE' as const,
        gstInclusive: true,
        shippingCharges: 0,
        overallDiscount: 0,
        additionalCharges: 0,
        lines: [
          {
            unitPrice: 32000, // ₹320.00
            quantity: 500,    // 5.00 units
            discountPercent: 0,
            taxRate: 1800,    // 18.00%
            supplyType: 'INTRASTATE' as const,
            gstInclusive: true,
          },
        ],
      }

      const totals = calculateInvoiceTotals(gstInput)

      expect(totals.grandTotal).toBe(160000) // ₹1,600.00
      expect(totals.taxableAmount).toBe(135593) // ₹1,355.93
      expect(totals.cgstAmount).toBe(12203)    // ₹122.03
      expect(totals.sgstAmount).toBe(12203)    // ₹122.03
      expect(totals.igstAmount).toBe(0)
      expect(totals.totalTax).toBe(24406)      // ₹244.06
      expect(totals.roundOff).toBe(1)          // ₹0.01 round-off to exact ₹1,600.00
      expect(totals.taxableAmount + totals.totalTax + totals.roundOff).toBe(totals.grandTotal)
    })

    it('calculates Interstate (IGST 18%) tax-exclusive invoice with shipping and discount', () => {
      // 2 units at ₹1,000.00 each (tax exclusive at 18%) = ₹2,000.00 taxable
      // Shipping charges: ₹200.00
      // Overall discount: ₹100.00
      const gstInput = {
        supplyType: 'INTERSTATE' as const,
        gstInclusive: false,
        shippingCharges: 20000, // ₹200.00
        overallDiscount: 10000, // ₹100.00
        additionalCharges: 0,
        lines: [
          {
            unitPrice: 100000, // ₹1,000.00
            quantity: 200,     // 2.00 units
            discountPercent: 0,
            taxRate: 1800,     // 18.00%
            supplyType: 'INTERSTATE' as const,
            gstInclusive: false,
          },
        ],
      }

      const totals = calculateInvoiceTotals(gstInput)

      expect(totals.subtotal).toBe(200000) // ₹2,000.00
      expect(totals.shippingCharges).toBe(20000)
      expect(totals.discountAmount).toBe(10000)
      expect(totals.taxableAmount).toBe(200000)
      expect(totals.cgstAmount).toBe(0)
      expect(totals.sgstAmount).toBe(0)
      expect(totals.igstAmount).toBe(36000) // 18% of ₹2,000.00 = ₹360.00
      // Grand total = 2000.00 + 360.00 (tax) + 200.00 (shipping) - 100.00 (discount) = 2460.00
      expect(totals.grandTotal).toBe(246000) // ₹2,460.00
    })
  })

  describe('2. Invoice Payment Lifecycle & Paid / Unpaid State Transitions', () => {
    function computePaymentStatus(totalAmount: number, paidAmount: number): {
      paymentStatus: PaymentStatus
      status: InvoiceStatus
      balanceDue: number
    } {
      const balanceDue = Math.max(0, totalAmount - paidAmount)
      let paymentStatus: PaymentStatus = 'UNPAID'
      let status: InvoiceStatus = 'FINALIZED'

      if (paidAmount >= totalAmount) {
        paymentStatus = 'PAID'
        status = 'PAID'
      } else if (paidAmount > 0) {
        paymentStatus = 'PARTIALLY_PAID'
        status = 'PARTIALLY_PAID'
      }

      return { paymentStatus, status, balanceDue }
    }

    it('correctly initializes finalized invoice as UNPAID with full balance due', () => {
      const invoiceTotal = 250000 // ₹2,500.00
      const initial = computePaymentStatus(invoiceTotal, 0)

      expect(initial.paymentStatus).toBe('UNPAID')
      expect(initial.status).toBe('FINALIZED')
      expect(initial.balanceDue).toBe(250000)
    })

    it('transitions to PARTIALLY_PAID when partial payment is recorded', () => {
      const invoiceTotal = 250000 // ₹2,500.00
      const firstPayment = 100000 // ₹1,000.00
      const afterFirstPayment = computePaymentStatus(invoiceTotal, firstPayment)

      expect(afterFirstPayment.paymentStatus).toBe('PARTIALLY_PAID')
      expect(afterFirstPayment.status).toBe('PARTIALLY_PAID')
      expect(afterFirstPayment.balanceDue).toBe(150000) // ₹1,500.00 remaining
    })

    it('transitions to PAID and clears balance due when second payment clears remaining balance', () => {
      const invoiceTotal = 250000 // ₹2,500.00
      const firstPayment = 100000 // ₹1,000.00
      const secondPayment = 150000 // ₹1,500.00
      const totalPaid = firstPayment + secondPayment
      const afterSecondPayment = computePaymentStatus(invoiceTotal, totalPaid)

      expect(afterSecondPayment.paymentStatus).toBe('PAID')
      expect(afterSecondPayment.status).toBe('PAID')
      expect(afterSecondPayment.balanceDue).toBe(0)
    })

    it('prevents negative balance due if payment exceeds total', () => {
      const invoiceTotal = 100000 // ₹1,000.00
      const overpaid = computePaymentStatus(invoiceTotal, 120000)

      expect(overpaid.paymentStatus).toBe('PAID')
      expect(overpaid.status).toBe('PAID')
      expect(overpaid.balanceDue).toBe(0)
    })
  })

  describe('3. Ledger-Billing Integration Pipeline', () => {
    interface LedgerEntryMock {
      date: string
      refType: 'INVOICE' | 'PAYMENT' | 'CANCEL'
      description: string
      debit: number
      credit: number
      balance: number
    }

    class MockLedgerAccount {
      entries: LedgerEntryMock[] = []
      currentBalance = 0

      addDebit(date: string, refType: 'INVOICE', desc: string, debitAmount: number) {
        this.currentBalance += debitAmount
        this.entries.push({
          date,
          refType,
          description: desc,
          debit: debitAmount,
          credit: 0,
          balance: this.currentBalance,
        })
      }

      addCredit(date: string, refType: 'PAYMENT' | 'CANCEL', desc: string, creditAmount: number) {
        this.currentBalance -= creditAmount
        this.entries.push({
          date,
          refType,
          description: desc,
          debit: 0,
          credit: creditAmount,
          balance: this.currentBalance,
        })
      }

      getSummary(openingBalance = 0) {
        const totalDebit = this.entries.reduce((s, e) => s + e.debit, 0)
        const totalCredit = this.entries.reduce((s, e) => s + e.credit, 0)
        return {
          openingBalance,
          totalDebit,
          totalCredit,
          closingBalance: openingBalance + totalDebit - totalCredit,
        }
      }
    }

    it('simulates full billing-to-ledger cycle across multiple invoices and payments', () => {
      const customerLedger = new MockLedgerAccount()

      // 1. Customer buys goods on Invoice #001 for ₹10,000.00
      customerLedger.addDebit('2026-10-01', 'INVOICE', 'Invoice INV/26-27/0001 — Kashyap Enterprises', 1000000)
      expect(customerLedger.currentBalance).toBe(1000000) // ₹10,000.00 outstanding

      // 2. Customer pays ₹4,000.00 via UPI
      customerLedger.addCredit('2026-10-02', 'PAYMENT', 'Payment received via UPI (Ref: UTR998811)', 400000)
      expect(customerLedger.currentBalance).toBe(600000) // ₹6,000.00 outstanding

      // 3. Customer buys more goods on Invoice #002 for ₹5,000.00
      customerLedger.addDebit('2026-10-03', 'INVOICE', 'Invoice INV/26-27/0002 — Kashyap Enterprises', 500000)
      expect(customerLedger.currentBalance).toBe(1100000) // ₹11,000.00 outstanding

      // 4. Customer pays ₹11,000.00 in full via Bank Transfer
      customerLedger.addCredit('2026-10-05', 'PAYMENT', 'Payment received via Bank Transfer (Ref: NEFT776655)', 1100000)
      expect(customerLedger.currentBalance).toBe(0) // Completely settled!

      // 5. Verify ledger summary
      const summary = customerLedger.getSummary(0)
      expect(summary.totalDebit).toBe(1500000) // ₹15,000.00 total billed
      expect(summary.totalCredit).toBe(1500000) // ₹15,000.00 total received
      expect(summary.closingBalance).toBe(0)

      // 6. Verify each entry satisfies running balance invariant
      let calculatedBalance = 0
      for (const entry of customerLedger.entries) {
        calculatedBalance = calculatedBalance + entry.debit - entry.credit
        expect(entry.balance).toBe(calculatedBalance)
      }
    })

    it('correctly credits and restores ledger balance upon invoice cancellation', () => {
      const customerLedger = new MockLedgerAccount()

      // Invoice created: ₹25,000.00
      customerLedger.addDebit('2026-10-01', 'INVOICE', 'Invoice INV/26-27/0003', 2500000)
      expect(customerLedger.currentBalance).toBe(2500000)

      // Invoice cancelled by user: cancels the debit with matching credit
      customerLedger.addCredit('2026-10-01', 'CANCEL', 'Cancellation of Invoice INV/26-27/0003', 2500000)
      expect(customerLedger.currentBalance).toBe(0)

      const summary = customerLedger.getSummary(0)
      expect(summary.totalDebit).toBe(2500000)
      expect(summary.totalCredit).toBe(2500000)
      expect(summary.closingBalance).toBe(0)
    })
  })

  describe('4. CSV Export Engine & File Generation', () => {
    it('generates fully compliant Invoices CSV with correct headers and balance due', () => {
      const headers = [
        'Invoice Number',
        'Date',
        'Due Date',
        'Customer',
        'Customer GSTIN',
        'Supply Type',
        'Taxable Amount (₹)',
        'CGST (₹)',
        'SGST (₹)',
        'IGST (₹)',
        'Total Tax (₹)',
        'Round Off (₹)',
        'Grand Total (₹)',
        'Paid Amount (₹)',
        'Balance Due (₹)',
        'Status',
        'Payment Status',
        'Payment Method',
      ]

      const sampleInvoices = [
        {
          num: 'INV/26-27/0001',
          date: '2026-10-01',
          dueDate: '2026-10-15',
          customer: 'Saarthi Chemicals, GIDC',
          gstin: '24AAAAA0000A1Z5',
          supplyType: 'INTRASTATE',
          taxable: 100000,
          cgst: 9000,
          sgst: 9000,
          igst: 0,
          tax: 18000,
          roundOff: 0,
          total: 118000,
          paid: 118000,
          status: 'PAID',
          payStatus: 'PAID',
          method: 'UPI',
        },
        {
          num: 'INV/26-27/0002',
          date: '2026-10-02',
          dueDate: '2026-10-16',
          customer: 'Kashyap Bhanushali & Co.',
          gstin: '24AABCK1234F1Z1',
          supplyType: 'INTRASTATE',
          taxable: 200000,
          cgst: 18000,
          sgst: 18000,
          igst: 0,
          tax: 36000,
          roundOff: 0,
          total: 236000,
          paid: 100000,
          status: 'PARTIALLY_PAID',
          payStatus: 'PARTIALLY_PAID',
          method: 'BANK_TRANSFER',
        },
      ]

      const rows = sampleInvoices.map((inv) => [
        inv.num,
        inv.date,
        inv.dueDate,
        inv.customer,
        inv.gstin,
        inv.supplyType,
        paiseToRupees(inv.taxable),
        paiseToRupees(inv.cgst),
        paiseToRupees(inv.sgst),
        paiseToRupees(inv.igst),
        paiseToRupees(inv.tax),
        paiseToRupees(inv.roundOff),
        paiseToRupees(inv.total),
        paiseToRupees(inv.paid),
        paiseToRupees(Math.max(0, inv.total - inv.paid)),
        inv.status,
        inv.payStatus,
        inv.method,
      ])

      const csv = generateCSV(headers, rows)

      // Verify headers
      expect(csv).toContain('Invoice Number,Date,Due Date,Customer,Customer GSTIN,Supply Type')
      expect(csv).toContain('Grand Total (₹),Paid Amount (₹),Balance Due (₹)')

      // Verify comma escaping in customer name
      expect(csv).toContain('"Saarthi Chemicals, GIDC"')

      // Verify formatted rupee values (plain decimals without commas so Excel treats as numbers)
      expect(csv).toContain('1180.00') // Paid invoice
      expect(csv).toContain('2360.00') // Partially paid invoice
      expect(csv).toContain('1360.00') // Remaining balance due for #0002

      // Verify parse roundtrip
      const parsed = parseCSVToRows(csv)
      expect(parsed.length).toBe(3) // 1 header + 2 data rows
      expect(parsed[1][0]).toBe('INV/26-27/0001')
      expect(parsed[1][3]).toBe('Saarthi Chemicals, GIDC')
      expect(parsed[2][14]).toBe('1360.00') // Balance due column
    })

    it('generates compliant Customer Ledger CSV with transactions and closing summary', () => {
      const headers = [
        'Date',
        'Party Type',
        'Party Name',
        'Reference Type',
        'Description',
        'Debit (₹)',
        'Credit (₹)',
        'Running Balance (₹)',
      ]

      const ledgerData = [
        ['2026-10-01', 'CUSTOMER', 'Kashyap Bhanushali & Co.', 'INVOICE', 'Invoice INV/26-27/0001', '1,180.00', '0.00', '1,180.00'],
        ['2026-10-02', 'CUSTOMER', 'Kashyap Bhanushali & Co.', 'PAYMENT', 'UPI Payment received (Ref: 1234)', '0.00', '500.00', '680.00'],
        ['2026-10-03', 'CUSTOMER', 'Kashyap Bhanushali & Co.', 'PAYMENT', 'Cash Payment received in full', '0.00', '680.00', '0.00'],
        ['TOTAL / CLOSING', '', 'Kashyap Bhanushali & Co.', 'SUMMARY', 'Closing Balance: 0.00', '1,180.00', '1,180.00', '0.00'],
      ]

      const csv = generateCSV(headers, ledgerData)

      expect(csv).toContain('Running Balance (₹)')
      expect(csv).toContain('TOTAL / CLOSING')
      expect(csv).toContain('1,180.00')
      expect(csv).toContain('680.00')

      const parsed = parseCSVToRows(csv)
      expect(parsed.length).toBe(5) // header + 3 entries + 1 summary
      expect(parsed[4][0]).toBe('TOTAL / CLOSING')
      expect(parsed[4][5]).toBe('1,180.00') // Total Debit
      expect(parsed[4][6]).toBe('1,180.00') // Total Credit
      expect(parsed[4][7]).toBe('0.00')     // Closing Balance
    })

    it('handles quotes, multi-line notes, and special characters cleanly according to RFC-4180', () => {
      const headers = ['Description', 'Notes']
      const rows = [
        ['Industrial Grade "A" Resin', 'Line 1\nLine 2'],
        ['Standard Packaging, 50-Boxes', 'Simple note'],
      ]

      const csv = generateCSV(headers, rows)
      expect(csv).toContain('"Industrial Grade ""A"" Resin"')
      expect(csv).toContain('"Standard Packaging, 50-Boxes"')

      const parsed = parseCSVToRows(csv)
      expect(parsed.length).toBe(3)
      expect(parsed[1][0]).toBe('Industrial Grade "A" Resin')
      expect(parsed[2][0]).toBe('Standard Packaging, 50-Boxes')
    })
  })
})
