/**
 * ORION GST Calculation Engine
 * 
 * CENTRALIZED, DETERMINISTIC, TESTABLE.
 * 
 * This is the single source of truth for all GST calculations in ORION.
 * Do NOT duplicate GST logic in React components or other services.
 * 
 * Design principles:
 * - All inputs/outputs in PAISE (integers) to avoid floating-point errors
 * - Rates stored as BASIS POINTS (100 = 1%, 1800 = 18%)
 * - Uses decimal.js for all intermediate calculations
 * - Fully pure functions — no side effects, no DB calls
 * - Every function is independently testable
 * 
 * GST Rules (India):
 * - INTRASTATE supply (same state): CGST (rate/2) + SGST (rate/2)
 * - INTERSTATE supply (different states): IGST (full rate)
 * - Supply type determined by comparing business state code vs customer state code
 */

import Decimal from 'decimal.js'
import { applyBasisPoints, computeDiscount, roundToRupee, sumPaise } from '@utils/decimal'
import type { InvoiceItemFormData, InvoiceItem, InvoiceTotals } from '@/types/invoice'
import type { SupplyType } from '@/types/invoice'

// ============================================================
// TYPES
// ============================================================

export interface GSTLineInput {
  /** Unit price in paise */
  unitPrice: number
  /** Quantity as integer × 100 (e.g., 250 = 2.5 units) */
  quantity: number
  /** Discount in basis points (100 = 1%) */
  discountPercent: number
  /** GST rate in basis points (1800 = 18%) */
  taxRate: number
  /** Whether this is interstate supply */
  supplyType: SupplyType
  /** Whether prices are GST-inclusive */
  gstInclusive?: boolean
}

export interface GSTLineResult {
  grossAmount: number        // unitPrice × quantity, in paise
  discountAmount: number     // discount applied on grossAmount
  taxableAmount: number      // grossAmount - discountAmount (exclusive base)
  cgstRate: number           // basis points
  sgstRate: number           // basis points
  igstRate: number           // basis points
  cgstAmount: number         // paise
  sgstAmount: number         // paise
  igstAmount: number         // paise
  totalTax: number           // paise
  totalAmount: number        // taxableAmount + totalTax
}

export interface GSTInvoiceInput {
  lines: GSTLineInput[]
  supplyType: SupplyType
  gstInclusive?: boolean
  shippingCharges?: number
  overallDiscount?: number
  additionalCharges?: number
}

export interface GSTInvoiceTotals {
  subtotal: number          // sum of gross amounts (pre-discount)
  discountAmount: number    // total discount (lines + overall)
  taxableAmount: number     // subtotal - discount
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalTax: number
  shippingCharges: number   // transportation / freight
  overallDiscount: number   // additional bill discount
  additionalCharges: number // other charges (+/-)
  rawTotal: number          // taxableAmount + totalTax + shippingCharges + additionalCharges - overallDiscount
  roundOff: number          // adjustment to nearest rupee
  grandTotal: number        // final rounded amount
  lineResults: GSTLineResult[]
}

// ============================================================
// CORE LINE-ITEM CALCULATION
// ============================================================

/**
 * Calculate GST for a single line item.
 * 
 * @param input Line item input parameters
 * @returns Fully calculated line item with all GST components
 */
export function calculateGSTLine(input: GSTLineInput): GSTLineResult {
  const { unitPrice, quantity, discountPercent, taxRate, supplyType, gstInclusive = false } = input

  // Gross amount: unit_price × quantity
  // quantity is stored as integer × 100, so divide by 100
  const grossAmount = new Decimal(unitPrice)
    .times(quantity)
    .dividedBy(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber()

  // Discount amount
  const discountAmount = computeDiscount(grossAmount, discountPercent)

  // Net amount before tax
  const netBeforeTax = grossAmount - discountAmount

  let taxableAmount: number
  let totalTax: number

  if (gstInclusive) {
    // Back-calculate taxable amount from GST-inclusive price
    // taxableAmount = netBeforeTax × 10000 / (10000 + taxRate)
    taxableAmount = new Decimal(netBeforeTax)
      .times(10000)
      .dividedBy(new Decimal(10000).plus(taxRate))
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber()
    totalTax = netBeforeTax - taxableAmount
  } else {
    taxableAmount = netBeforeTax
    totalTax = applyBasisPoints(taxableAmount, taxRate)
  }

  // Determine CGST/SGST vs IGST
  let cgstRate = 0
  let sgstRate = 0
  let igstRate = 0
  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0

  if (supplyType === 'INTRASTATE') {
    // Split equally between CGST and SGST
    cgstRate = Math.floor(taxRate / 2)
    sgstRate = taxRate - cgstRate  // handles odd basis points (e.g., 50bp for 0.5%)
    cgstAmount = applyBasisPoints(taxableAmount, cgstRate)
    sgstAmount = applyBasisPoints(taxableAmount, sgstRate)
    igstAmount = 0
    igstRate = 0
    // Recalculate totalTax from components (avoids rounding mismatch)
    totalTax = cgstAmount + sgstAmount
  } else {
    // Interstate: IGST only
    igstRate = taxRate
    igstAmount = applyBasisPoints(taxableAmount, igstRate)
    cgstRate = 0
    sgstRate = 0
    cgstAmount = 0
    sgstAmount = 0
    totalTax = igstAmount
  }

  return {
    grossAmount,
    discountAmount,
    taxableAmount,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    totalAmount: taxableAmount + totalTax,
  }
}

/**
 * Back-calculate taxable base and GST components from an MRP (which is inclusive of GST).
 * 
 * Formula: Taxable Base = (MRP * 10000) / (10000 + taxRateBasisPoints)
 * GST Amount = MRP - Taxable Base
 * 
 * @param mrpPaise MRP in paise (e.g., Rs. 118 = 11800 paise)
 * @param taxRateBasisPoints Tax rate in basis points (e.g., 18% = 1800)
 */
export function calculateReverseTaxFromMRP(
  mrpPaise: number,
  taxRateBasisPoints: number,
): { taxableBase: number; taxAmount: number } {
  if (taxRateBasisPoints <= 0 || mrpPaise <= 0) {
    return { taxableBase: mrpPaise, taxAmount: 0 }
  }

  const taxableBase = new Decimal(mrpPaise)
    .times(10000)
    .dividedBy(new Decimal(10000).plus(taxRateBasisPoints))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber()

  const taxAmount = mrpPaise - taxableBase

  return { taxableBase, taxAmount }
}

// ============================================================
// INVOICE-LEVEL TOTALS
// ============================================================

/**
 * Calculate all invoice-level totals from an array of line items and charges.
 * This is the function called by the invoice editor in real-time.
 */
export function calculateInvoiceTotals(input: GSTInvoiceInput): GSTInvoiceTotals {
  const lineResults = input.lines.map((line) =>
    calculateGSTLine({ ...line, supplyType: input.supplyType, gstInclusive: input.gstInclusive }),
  )

  const subtotal = sumPaise(lineResults.map((l) => l.grossAmount))
  const lineDiscountAmount = sumPaise(lineResults.map((l) => l.discountAmount))
  const overallDiscount = Math.max(0, input.overallDiscount ?? 0)
  const discountAmount = lineDiscountAmount + overallDiscount
  const taxableAmount = sumPaise(lineResults.map((l) => l.taxableAmount))
  const cgstAmount = sumPaise(lineResults.map((l) => l.cgstAmount))
  const sgstAmount = sumPaise(lineResults.map((l) => l.sgstAmount))
  const igstAmount = sumPaise(lineResults.map((l) => l.igstAmount))
  const totalTax = cgstAmount + sgstAmount + igstAmount

  const shippingCharges = input.shippingCharges ?? 0
  const additionalCharges = input.additionalCharges ?? 0

  const rawTotal = taxableAmount + totalTax + shippingCharges + additionalCharges - overallDiscount
  const { rounded: grandTotal, roundOff } = roundToRupee(Math.max(0, rawTotal))

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    shippingCharges,
    overallDiscount,
    additionalCharges,
    rawTotal,
    roundOff,
    grandTotal,
    lineResults,
  }
}

// ============================================================
// SUPPLY TYPE DETERMINATION
// ============================================================

/**
 * Determine supply type based on business and customer state codes.
 * Returns INTERSTATE if state codes differ or if either is missing.
 */
export function determineSupplyType(
  businessStateCode: string | null | undefined,
  customerStateCode: string | null | undefined,
): SupplyType {
  if (!businessStateCode || !customerStateCode) return 'INTRASTATE'
  return businessStateCode === customerStateCode ? 'INTRASTATE' : 'INTERSTATE'
}

// ============================================================
// GST RATE HELPERS
// ============================================================

/** Standard GST rates as basis points */
export const STANDARD_GST_RATES = [
  { label: 'Nil (0%)', value: 0 },
  { label: '0.1%', value: 10 },
  { label: '0.25%', value: 25 },
  { label: '1.5%', value: 150 },
  { label: '3%', value: 300 },
  { label: '5%', value: 500 },
  { label: '7.5%', value: 750 },
  { label: '12%', value: 1200 },
  { label: '18%', value: 1800 },
  { label: '28%', value: 2800 },
] as const

/** Format a GST rate basis points to percentage string */
export function formatGSTRate(basisPoints: number): string {
  if (basisPoints === 0) return 'Nil'
  const pct = basisPoints / 100
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`
}

/** Validate that a GST rate is one of the standard rates */
export function isValidGSTRate(basisPoints: number): boolean {
  return STANDARD_GST_RATES.some((r) => r.value === basisPoints)
}

// ============================================================
// GST REPORT AGGREGATION
// ============================================================

export interface GSTSummary {
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalTax: number
  grandTotal: number
}

export interface GSTByRate {
  taxRate: number
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalTax: number
}

/** Aggregate GST by tax rate slab for GST reports (GSTR-1 style) */
export function aggregateGSTByRate(
  items: Array<{
    taxRate: number
    taxableAmount: number
    cgstAmount: number
    sgstAmount: number
    igstAmount: number
  }>,
): GSTByRate[] {
  const byRate = new Map<number, GSTByRate>()

  for (const item of items) {
    const existing = byRate.get(item.taxRate) ?? {
      taxRate: item.taxRate,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
    }

    existing.taxableAmount += item.taxableAmount
    existing.cgstAmount += item.cgstAmount
    existing.sgstAmount += item.sgstAmount
    existing.igstAmount += item.igstAmount
    existing.totalTax += item.cgstAmount + item.sgstAmount + item.igstAmount

    byRate.set(item.taxRate, existing)
  }

  return Array.from(byRate.values()).sort((a, b) => a.taxRate - b.taxRate)
}
