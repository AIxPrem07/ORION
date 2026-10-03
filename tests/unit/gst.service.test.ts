/**
 * ORION GST Calculation Engine — Unit Test Suite
 * 
 * Tests ALL critical GST scenarios as specified in section 24 of the spec.
 * 
 * Run with: npx vitest run tests/unit/gst.service.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  calculateGSTLine,
  calculateInvoiceTotals,
  calculateReverseTaxFromMRP,
  determineSupplyType,
  aggregateGSTByRate,
  type GSTLineInput,
} from '@services/gst.service'

// ============================================================
// HELPER
// ============================================================

function line(overrides: Partial<GSTLineInput> = {}): GSTLineInput {
  return {
    unitPrice: 100_00,    // ₹100 in paise
    quantity: 100,        // 1 unit (× 100 storage)
    discountPercent: 0,
    taxRate: 1800,        // 18%
    supplyType: 'INTRASTATE',
    gstInclusive: false,
    ...overrides,
  }
}

// ============================================================
// SUPPLY TYPE DETERMINATION
// ============================================================

describe('determineSupplyType', () => {
  it('returns INTRASTATE when both state codes are the same', () => {
    expect(determineSupplyType('27', '27')).toBe('INTRASTATE')
  })

  it('returns INTERSTATE when state codes differ', () => {
    expect(determineSupplyType('27', '29')).toBe('INTERSTATE')
  })

  it('returns INTRASTATE when business state code is null', () => {
    expect(determineSupplyType(null, '27')).toBe('INTRASTATE')
  })

  it('returns INTRASTATE when customer state code is null', () => {
    expect(determineSupplyType('27', null)).toBe('INTRASTATE')
  })
})

// ============================================================
// INTRASTATE (CGST + SGST)
// ============================================================

describe('Intrastate supply — CGST + SGST', () => {
  it('correctly splits 18% GST into 9% CGST + 9% SGST', () => {
    const result = calculateGSTLine(line({ taxRate: 1800, supplyType: 'INTRASTATE' }))
    expect(result.cgstRate).toBe(900)
    expect(result.sgstRate).toBe(900)
    expect(result.igstRate).toBe(0)
    expect(result.igstAmount).toBe(0)
    // ₹100 taxable → CGST = ₹9 = 900 paise, SGST = ₹9 = 900 paise
    expect(result.cgstAmount).toBe(900)
    expect(result.sgstAmount).toBe(900)
    expect(result.totalTax).toBe(1800)
    expect(result.totalAmount).toBe(11800) // ₹118
  })

  it('correctly splits 12% GST into 6% CGST + 6% SGST', () => {
    const result = calculateGSTLine(line({ taxRate: 1200, supplyType: 'INTRASTATE' }))
    expect(result.cgstRate).toBe(600)
    expect(result.sgstRate).toBe(600)
    expect(result.cgstAmount).toBe(600)
    expect(result.sgstAmount).toBe(600)
    expect(result.totalTax).toBe(1200)
  })

  it('correctly splits 5% GST into 2.5% CGST + 2.5% SGST', () => {
    const result = calculateGSTLine(line({ taxRate: 500, supplyType: 'INTRASTATE' }))
    expect(result.cgstRate).toBe(250)
    expect(result.sgstRate).toBe(250)
    expect(result.cgstAmount).toBe(250)
    expect(result.sgstAmount).toBe(250)
    expect(result.totalTax).toBe(500)
  })

  it('correctly splits 28% GST into 14% CGST + 14% SGST', () => {
    const result = calculateGSTLine(line({ taxRate: 2800, supplyType: 'INTRASTATE' }))
    expect(result.cgstRate).toBe(1400)
    expect(result.sgstRate).toBe(1400)
    expect(result.cgstAmount).toBe(1400)
    expect(result.sgstAmount).toBe(1400)
    expect(result.totalTax).toBe(2800)
  })
})

// ============================================================
// INTERSTATE (IGST)
// ============================================================

describe('Interstate supply — IGST', () => {
  it('applies full 18% as IGST for interstate', () => {
    const result = calculateGSTLine(line({ taxRate: 1800, supplyType: 'INTERSTATE' }))
    expect(result.cgstRate).toBe(0)
    expect(result.sgstRate).toBe(0)
    expect(result.igstRate).toBe(1800)
    expect(result.cgstAmount).toBe(0)
    expect(result.sgstAmount).toBe(0)
    expect(result.igstAmount).toBe(1800)
    expect(result.totalTax).toBe(1800)
  })

  it('applies full 5% as IGST for interstate', () => {
    const result = calculateGSTLine(line({ taxRate: 500, supplyType: 'INTERSTATE' }))
    expect(result.igstAmount).toBe(500)
    expect(result.cgstAmount).toBe(0)
    expect(result.sgstAmount).toBe(0)
  })
})

// ============================================================
// ZERO RATE (0% GST)
// ============================================================

describe('0% GST (Nil rated)', () => {
  it('produces zero tax on 0% GST intrastate', () => {
    const result = calculateGSTLine(line({ taxRate: 0, supplyType: 'INTRASTATE' }))
    expect(result.cgstAmount).toBe(0)
    expect(result.sgstAmount).toBe(0)
    expect(result.igstAmount).toBe(0)
    expect(result.totalTax).toBe(0)
    expect(result.totalAmount).toBe(10000) // just ₹100
  })

  it('produces zero tax on 0% GST interstate', () => {
    const result = calculateGSTLine(line({ taxRate: 0, supplyType: 'INTERSTATE' }))
    expect(result.igstAmount).toBe(0)
    expect(result.totalTax).toBe(0)
  })
})

// ============================================================
// DISCOUNT BEFORE TAX
// ============================================================

describe('Discount before tax', () => {
  it('applies 10% discount before calculating GST', () => {
    // ₹100 × 1 unit = ₹100 gross
    // 10% discount = ₹10
    // taxable = ₹90
    // 18% GST on ₹90 = ₹16.2 → but we're in paise so 9000 × 0.18 = 1620
    const result = calculateGSTLine(
      line({ taxRate: 1800, discountPercent: 1000, supplyType: 'INTRASTATE' }),
    )
    expect(result.grossAmount).toBe(10000)     // ₹100
    expect(result.discountAmount).toBe(1000)   // ₹10
    expect(result.taxableAmount).toBe(9000)    // ₹90
    expect(result.cgstAmount).toBe(810)        // 9% of ₹90 = ₹8.10
    expect(result.sgstAmount).toBe(810)        // 9% of ₹90 = ₹8.10
    expect(result.totalTax).toBe(1620)         // ₹16.20
    expect(result.totalAmount).toBe(10620)     // ₹90 + ₹16.20 = ₹106.20
  })

  it('applies 20% discount correctly', () => {
    const result = calculateGSTLine(
      line({ unitPrice: 50000, quantity: 100, discountPercent: 2000, taxRate: 1800, supplyType: 'INTRASTATE' }),
    )
    // ₹500 × 1 = ₹500; 20% off = ₹100 discount; taxable = ₹400
    expect(result.grossAmount).toBe(50000)
    expect(result.discountAmount).toBe(10000)
    expect(result.taxableAmount).toBe(40000)
    // 9% CGST on ₹400 = ₹36 = 3600 paise
    expect(result.cgstAmount).toBe(3600)
    expect(result.sgstAmount).toBe(3600)
  })
})

// ============================================================
// GST-INCLUSIVE PRICING
// ============================================================

describe('GST-inclusive pricing', () => {
  it('back-calculates taxable amount from inclusive price', () => {
    // ₹118 inclusive of 18% GST
    // taxable = 118 × 10000 / (10000 + 1800) = 118 × 10000 / 11800 ≈ 100
    const result = calculateGSTLine(
      line({ unitPrice: 11800, quantity: 100, taxRate: 1800, supplyType: 'INTRASTATE', gstInclusive: true }),
    )
    expect(result.taxableAmount).toBe(10000)    // ₹100
    expect(result.totalTax).toBe(1800)          // ₹18
    expect(result.totalAmount).toBe(11800)      // ₹118 (unchanged gross)
  })

  it('back-calculates taxable amount with 5% GST inclusive', () => {
    // ₹105 inclusive of 5% GST → taxable = 105 × 10000 / 10500 ≈ 10000 paise
    const result = calculateGSTLine(
      line({ unitPrice: 10500, quantity: 100, taxRate: 500, supplyType: 'INTRASTATE', gstInclusive: true }),
    )
    expect(result.taxableAmount).toBe(10000)
  })
})

// ============================================================
// QUANTITY VARIATIONS
// ============================================================

describe('Quantity calculations', () => {
  it('calculates correctly for 2.5 units (quantity = 250)', () => {
    // 2.5 units × ₹100 = ₹250; 18% GST = ₹45; total = ₹295
    const result = calculateGSTLine(line({ unitPrice: 10000, quantity: 250, taxRate: 1800, supplyType: 'INTRASTATE' }))
    expect(result.grossAmount).toBe(25000)    // ₹250
    expect(result.taxableAmount).toBe(25000)
    expect(result.cgstAmount).toBe(2250)      // ₹22.50
    expect(result.sgstAmount).toBe(2250)
    expect(result.totalTax).toBe(4500)        // ₹45
    expect(result.totalAmount).toBe(29500)    // ₹295
  })

  it('calculates correctly for 10 units', () => {
    const result = calculateGSTLine(line({ unitPrice: 10000, quantity: 1000, taxRate: 1800, supplyType: 'INTERSTATE' }))
    expect(result.grossAmount).toBe(100000)   // ₹1000
    expect(result.igstAmount).toBe(18000)     // ₹180
    expect(result.totalAmount).toBe(118000)   // ₹1180
  })
})

// ============================================================
// INVOICE-LEVEL TOTALS
// ============================================================

describe('Invoice-level totals with multiple lines', () => {
  it('aggregates multiple GST rates correctly', () => {
    const totals = calculateInvoiceTotals({
      supplyType: 'INTRASTATE',
      lines: [
        { unitPrice: 100_00, quantity: 100, discountPercent: 0, taxRate: 1800, supplyType: 'INTRASTATE' },  // ₹100 @ 18%
        { unitPrice: 200_00, quantity: 100, discountPercent: 0, taxRate: 1200, supplyType: 'INTRASTATE' },  // ₹200 @ 12%
        { unitPrice: 50_00, quantity: 100, discountPercent: 0, taxRate: 500, supplyType: 'INTRASTATE' },    // ₹50  @ 5%
      ],
    })

    expect(totals.subtotal).toBe(35000)        // ₹350
    expect(totals.taxableAmount).toBe(35000)   // no discounts
    // 18% on ₹100 = ₹18 → CGST ₹9, SGST ₹9
    // 12% on ₹200 = ₹24 → CGST ₹12, SGST ₹12
    // 5% on ₹50 = ₹2.50 → CGST ₹1.25, SGST ₹1.25
    expect(totals.cgstAmount).toBe(900 + 1200 + 125)   // 2225
    expect(totals.sgstAmount).toBe(900 + 1200 + 125)   // 2225
    expect(totals.igstAmount).toBe(0)
    expect(totals.totalTax).toBe(4450)         // ₹44.50
  })

  it('applies round-off to nearest rupee', () => {
    // Create a scenario where total has paise remainder
    const totals = calculateInvoiceTotals({
      supplyType: 'INTRASTATE',
      lines: [
        { unitPrice: 100_00, quantity: 300, discountPercent: 0, taxRate: 500, supplyType: 'INTRASTATE' },
        // 3 × ₹100 = ₹300; 5% = ₹15; total = ₹315 → exact rupee, no round-off needed
      ],
    })
    // This should be exact
    expect(totals.grandTotal % 100).toBe(0)
  })

  it('aggregates interstate IGST across multiple lines', () => {
    const totals = calculateInvoiceTotals({
      supplyType: 'INTERSTATE',
      lines: [
        { unitPrice: 100_00, quantity: 100, discountPercent: 0, taxRate: 1800, supplyType: 'INTERSTATE' },
        { unitPrice: 100_00, quantity: 100, discountPercent: 0, taxRate: 1800, supplyType: 'INTERSTATE' },
      ],
    })
    expect(totals.cgstAmount).toBe(0)
    expect(totals.sgstAmount).toBe(0)
    expect(totals.igstAmount).toBe(3600)  // 2 × ₹18 = ₹36
  })
})

// ============================================================
// GST AGGREGATION BY RATE
// ============================================================

describe('aggregateGSTByRate', () => {
  it('groups items by tax rate', () => {
    const items = [
      { taxRate: 1800, taxableAmount: 10000, cgstAmount: 900, sgstAmount: 900, igstAmount: 0 },
      { taxRate: 1800, taxableAmount: 20000, cgstAmount: 1800, sgstAmount: 1800, igstAmount: 0 },
      { taxRate: 1200, taxableAmount: 5000, cgstAmount: 300, sgstAmount: 300, igstAmount: 0 },
    ]
    const result = aggregateGSTByRate(items)
    expect(result).toHaveLength(2)
    const gst18 = result.find((r) => r.taxRate === 1800)!
    expect(gst18.taxableAmount).toBe(30000)
    expect(gst18.cgstAmount).toBe(2700)
    expect(gst18.sgstAmount).toBe(2700)
    const gst12 = result.find((r) => r.taxRate === 1200)!
    expect(gst12.taxableAmount).toBe(5000)
  })
})

// ============================================================
// EDGE CASES
// ============================================================

describe('Edge cases', () => {
  it('handles zero unit price', () => {
    const result = calculateGSTLine(line({ unitPrice: 0, taxRate: 1800 }))
    expect(result.grossAmount).toBe(0)
    expect(result.totalTax).toBe(0)
    expect(result.totalAmount).toBe(0)
  })

  it('handles empty invoice (no lines)', () => {
    const totals = calculateInvoiceTotals({ supplyType: 'INTRASTATE', lines: [] })
    expect(totals.subtotal).toBe(0)
    expect(totals.grandTotal).toBe(0)
    expect(totals.lineResults).toHaveLength(0)
  })

  it('handles 100% discount', () => {
    const result = calculateGSTLine(line({ discountPercent: 10000, taxRate: 1800 }))
    expect(result.discountAmount).toBe(10000)
    expect(result.taxableAmount).toBe(0)
    expect(result.totalTax).toBe(0)
    expect(result.totalAmount).toBe(0)
  })

  it('does not produce negative taxable amounts from rounding', () => {
    // Very small amount
    const result = calculateGSTLine(line({ unitPrice: 1, quantity: 100, taxRate: 1800 }))
    expect(result.taxableAmount).toBeGreaterThanOrEqual(0)
    expect(result.totalAmount).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================
// MRP REVERSE TAX CALCULATION
// ============================================================

describe('calculateReverseTaxFromMRP', () => {
  it('correctly calculates base price and 18% GST from MRP of Rs. 118', () => {
    // MRP = Rs. 118 = 11800 paise, Tax Rate = 18% = 1800 bp
    // Base should be Rs. 100 = 10000 paise, Tax = Rs. 18 = 1800 paise
    const res = calculateReverseTaxFromMRP(11800, 1800)
    expect(res.taxableBase).toBe(10000)
    expect(res.taxAmount).toBe(1800)
  })

  it('correctly calculates base price and 5% GST from MRP of Rs. 105', () => {
    const res = calculateReverseTaxFromMRP(10500, 500)
    expect(res.taxableBase).toBe(10000)
    expect(res.taxAmount).toBe(500)
  })

  it('handles 0% GST rate', () => {
    const res = calculateReverseTaxFromMRP(5000, 0)
    expect(res.taxableBase).toBe(5000)
    expect(res.taxAmount).toBe(0)
  })
})

// ============================================================
// ADDITIONAL CHARGES & OVERALL DISCOUNT
// ============================================================

describe('Invoice additional charges and discounts', () => {
  it('adds freight charges to grand total', () => {
    // 1 item: Rs. 100 + 18% GST = Rs. 118. Freight = Rs. 50 (5000 paise)
    // Grand Total = 118 + 50 = Rs. 168 (16800 paise)
    const totals = calculateInvoiceTotals({
      supplyType: 'INTRASTATE',
      lines: [line({ unitPrice: 10000, quantity: 100, taxRate: 1800 })],
      shippingCharges: 5000,
    })
    expect(totals.shippingCharges).toBe(5000)
    expect(totals.taxableAmount).toBe(10000)
    expect(totals.totalTax).toBe(1800)
    expect(totals.grandTotal).toBe(16800)
  })

  it('deducts overall discount from grand total', () => {
    // 1 item: Rs. 100 + 18% GST = Rs. 118. Overall discount = Rs. 18 (1800 paise)
    // Grand Total = Rs. 100 (10000 paise)
    const totals = calculateInvoiceTotals({
      supplyType: 'INTRASTATE',
      lines: [line({ unitPrice: 10000, quantity: 100, taxRate: 1800 })],
      overallDiscount: 1800,
    })
    expect(totals.overallDiscount).toBe(1800)
    expect(totals.grandTotal).toBe(10000)
  })

  it('correctly calculates total with freight, additional charges and discount together', () => {
    // 1 item: Rs. 100 + 18% GST = Rs. 118
    // + Freight: Rs. 50 (5000 paise)
    // + Packaging: Rs. 20 (2000 paise)
    // - Discount: Rs. 10 (1000 paise)
    // Grand Total = 118 + 50 + 20 - 10 = Rs. 178 (17800 paise)
    const totals = calculateInvoiceTotals({
      supplyType: 'INTRASTATE',
      lines: [line({ unitPrice: 10000, quantity: 100, taxRate: 1800 })],
      shippingCharges: 5000,
      additionalCharges: 2000,
      overallDiscount: 1000,
    })
    expect(totals.grandTotal).toBe(17800)
  })
})

