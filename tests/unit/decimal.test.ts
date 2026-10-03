import { describe, it, expect } from 'vitest'
import {
  rupeesToPaise,
  paiseToRupees,
  paiseToRupeesNum,
  formatCurrency,
  formatCurrencyCompact,
  multiplyPaise,
  dividePaise,
  applyBasisPoints,
  roundToRupee,
  quantityToInt,
  intToQuantity,
  percentToBasisPoints,
  basisPointsToPercent,
} from '@/utils/decimal'

describe('ORION Decimal Math & Currency Utilities', () => {
  describe('rupeesToPaise & paiseToRupees', () => {
    it('converts exact rupees to paise', () => {
      expect(rupeesToPaise(100)).toBe(10000)
      expect(rupeesToPaise(0.5)).toBe(50)
      expect(rupeesToPaise(0.01)).toBe(1)
      expect(rupeesToPaise(0)).toBe(0)
    })

    it('avoids floating point rounding errors', () => {
      // In JS: 0.1 + 0.2 = 0.30000000000000004
      expect(rupeesToPaise(0.1 + 0.2)).toBe(30)
      expect(rupeesToPaise('1234.56')).toBe(123456)
      expect(rupeesToPaise(1234.56)).toBe(123456)
    })

    it('converts paise to 2-decimal rupee strings', () => {
      expect(paiseToRupees(10000)).toBe('100.00')
      expect(paiseToRupees(50)).toBe('0.50')
      expect(paiseToRupees(1)).toBe('0.01')
      expect(paiseToRupees(0)).toBe('0.00')
      expect(paiseToRupees(123456)).toBe('1234.56')
    })

    it('converts paise to rupee numbers', () => {
      expect(paiseToRupeesNum(10000)).toBe(100)
      expect(paiseToRupeesNum(123456)).toBe(1234.56)
    })
  })

  describe('formatCurrency', () => {
    it('formats Indian rupee numbers with commas correctly', () => {
      expect(formatCurrency(100000)).toContain('1,000.00')
      expect(formatCurrency(10000000)).toContain('1,00,000.00')
      expect(formatCurrency(123456789)).toContain('12,34,567.89')
    })

    it('formats without symbol when showSymbol is false', () => {
      expect(formatCurrency(100000, false)).toBe('1,000.00')
    })
  })

  describe('formatCurrencyCompact', () => {
    it('formats Lakhs and Crores', () => {
      expect(formatCurrencyCompact(10000000)).toContain('1.00L')
      expect(formatCurrencyCompact(1000000000)).toContain('1.00Cr')
    })
  })

  describe('applyBasisPoints', () => {
    it('calculates GST amounts correctly', () => {
      // 18% of ₹1000 (100000 paise) = 18000 paise (₹180)
      expect(applyBasisPoints(100000, 1800)).toBe(18000)
      // 5% of ₹100 (10000 paise) = 500 paise (₹5)
      expect(applyBasisPoints(10000, 500)).toBe(500)
      // 12% of ₹150 (15000 paise) = 1800 paise (₹18)
      expect(applyBasisPoints(15000, 1200)).toBe(1800)
      // 28% of ₹250 (25000 paise) = 7000 paise (₹70)
      expect(applyBasisPoints(25000, 2800)).toBe(7000)
    })
  })

  describe('roundToRupee', () => {
    it('rounds paise to the nearest whole rupee (100 paise)', () => {
      // ₹100.40 -> ₹100.00 (diff: -40 paise)
      const res1 = roundToRupee(10040)
      expect(res1.rounded).toBe(10000)
      expect(res1.roundOff).toBe(-40)

      // ₹100.60 -> ₹101.00 (diff: +40 paise)
      const res2 = roundToRupee(10060)
      expect(res2.rounded).toBe(10100)
      expect(res2.roundOff).toBe(40)

      // Exact ₹100.00 -> no round off
      const res3 = roundToRupee(10000)
      expect(res3.rounded).toBe(10000)
      expect(res3.roundOff).toBe(0)
    })
  })

  describe('quantityToInt & intToQuantity', () => {
    it('stores 2-decimal quantities as integer × 100', () => {
      expect(quantityToInt(2.5)).toBe(250)
      expect(quantityToInt('2.5')).toBe(250)
      expect(quantityToInt(1)).toBe(100)
      expect(intToQuantity(250)).toBe(2.5)
      expect(intToQuantity(100)).toBe(1)
    })
  })

  describe('percentToBasisPoints & basisPointsToPercent', () => {
    it('converts percentages to basis points and vice versa', () => {
      expect(percentToBasisPoints(18)).toBe(1800)
      expect(percentToBasisPoints(2.5)).toBe(250)
      expect(basisPointsToPercent(1800)).toBe(18)
      expect(basisPointsToPercent(250)).toBe(2.5)
    })
  })
})
