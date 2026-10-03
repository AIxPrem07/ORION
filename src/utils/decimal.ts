/**
 * ORION Financial Arithmetic Utilities
 * 
 * All monetary values in ORION are stored as integers in paise (₹1 = 100 paise).
 * This module provides safe arithmetic using decimal.js to avoid floating-point errors.
 * 
 * NEVER use native JavaScript arithmetic (+, *, /) directly on monetary values.
 */
import Decimal from 'decimal.js'

// Configure Decimal.js for financial calculations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: 20,
  toExpNeg: -20,
})

/** Convert rupees (float) to paise (integer) */
export function rupeesToPaise(rupees: number | string): number {
  return new Decimal(rupees).times(100).round().toNumber()
}

/** Convert paise (integer) to rupees (float string, 2dp) */
export function paiseToRupees(paise: number): string {
  return new Decimal(paise).dividedBy(100).toFixed(2)
}

/** Convert paise to rupees as a number */
export function paiseToRupeesNum(paise: number): number {
  return new Decimal(paise).dividedBy(100).toDecimalPlaces(2).toNumber()
}

/** Format paise as Indian currency string: ₹1,23,456.78 */
export function formatCurrency(paise: number, showSymbol = true): string {
  const rupees = paiseToRupeesNum(paise)
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
  return showSymbol ? `₹${formatted}` : formatted
}

/** Format paise as compact Indian currency: ₹1.23L, ₹45K */
export function formatCurrencyCompact(paise: number): string {
  const rupees = paiseToRupeesNum(paise)
  if (rupees >= 1_00_00_000) {
    return `₹${(rupees / 1_00_00_000).toFixed(2)}Cr`
  } else if (rupees >= 1_00_000) {
    return `₹${(rupees / 1_00_000).toFixed(2)}L`
  } else if (rupees >= 1_000) {
    return `₹${(rupees / 1_000).toFixed(1)}K`
  }
  return formatCurrency(paise)
}

/**
 * Safe multiply: a * b in paise
 * @param a paise amount
 * @param b multiplier (e.g., quantity, basis points factor)
 */
export function multiplyPaise(a: number, b: number): number {
  return new Decimal(a).times(b).round().toNumber()
}

/**
 * Safe divide: a / b in paise
 */
export function dividePaise(a: number, b: number): number {
  return new Decimal(a).dividedBy(b).round().toNumber()
}

/**
 * Apply basis-point rate to paise amount
 * @param paise amount in paise
 * @param basisPoints rate in basis points (100 = 1%)
 */
export function applyBasisPoints(paise: number, basisPoints: number): number {
  return new Decimal(paise)
    .times(basisPoints)
    .dividedBy(10000)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber()
}

/** Sum an array of paise values safely */
export function sumPaise(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

/** Round paise to nearest rupee (for invoice round-off) */
export function roundToRupee(paise: number): { rounded: number; roundOff: number } {
  const rounded = Math.round(paise / 100) * 100
  return { rounded, roundOff: rounded - paise }
}

/** Convert quantity stored as integer×100 to display string */
export function formatQuantity(quantityInt: number): string {
  return new Decimal(quantityInt).dividedBy(100).toFixed(2).replace(/\.?0+$/, '')
}

/** Convert stored integer×100 to quantity number */
export function intToQuantity(quantityInt: number): number {
  return new Decimal(quantityInt).dividedBy(100).toNumber()
}

/** Convert display quantity string/number to stored integer×100 */
export function quantityToInt(quantity: number | string): number {
  return new Decimal(quantity).times(100).round().toNumber()
}

/** Convert percentage display (18%) to basis points (1800) */
export function percentToBasisPoints(percent: number | string): number {
  return new Decimal(percent).times(100).round().toNumber()
}

/** Convert basis points (1800) to percentage number (18) */
export function basisPointsToPercent(basisPoints: number): number {
  return new Decimal(basisPoints).dividedBy(100).toNumber()
}

/** Compute discount amount from paise amount and discount basis points */
export function computeDiscount(amount: number, discountBasisPoints: number): number {
  if (discountBasisPoints === 0) return 0
  return applyBasisPoints(amount, discountBasisPoints)
}
