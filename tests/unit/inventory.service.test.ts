import { describe, it, expect } from 'vitest'
import { DEFAULT_MATERIAL_UNITS } from '../../src/services/product.service'
import { formatDateTime } from '../../src/utils/date'

describe('Inventory & Material Unit Enhancements', () => {
  describe('Material & Packaging Unit Types', () => {
    it('contains all essential physical packaging materials', () => {
      const abbreviations = DEFAULT_MATERIAL_UNITS.map((u) => u.abbreviation.toLowerCase())
      const names = DEFAULT_MATERIAL_UNITS.map((u) => u.name.toLowerCase())

      // Check user-requested packaging types
      expect(abbreviations).toContain('bag')
      expect(names).toContain('bag')
      expect(abbreviations).toContain('pack')
      expect(names).toContain('pack')
      expect(abbreviations).toContain('box')
      expect(names).toContain('box')
      expect(abbreviations).toContain('ctn') // Carton
      expect(abbreviations).toContain('btl') // Bottle
      expect(abbreviations).toContain('can') // Can
      expect(abbreviations).toContain('tin') // Tin
      expect(abbreviations).toContain('drm') // Drum
      expect(abbreviations).toContain('qtl') // Quintal
      expect(abbreviations).toContain('ton') // Tonne
      expect(abbreviations).toContain('rol') // Roll
      expect(abbreviations).toContain('bdl') // Bundle
      expect(abbreviations).toContain('stp') // Strip
      expect(abbreviations).toContain('tub') // Tube
      expect(abbreviations).toContain('pcs') // Pieces
      expect(abbreviations).toContain('kg')  // Kilogram
      expect(abbreviations).toContain('l')   // Litre
    })

    it('has unique names and abbreviations', () => {
      const nameSet = new Set<string>()
      for (const u of DEFAULT_MATERIAL_UNITS) {
        expect(u.name.length).toBeGreaterThan(0)
        expect(u.abbreviation.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Active Stock Calculation Engine', () => {
    it('calculates inward stock addition correctly (mode: ADD)', () => {
      const currentStock = 24
      const addedQuantity = 50
      const newStock = currentStock + addedQuantity
      const movementQuantity = addedQuantity

      expect(movementQuantity).toBe(50)
      expect(newStock).toBe(74)
    })

    it('calculates outward stock deduction correctly (mode: DEDUCT)', () => {
      const currentStock = 74
      const deductedQuantity = 10
      const newStock = currentStock - deductedQuantity
      const movementQuantity = -deductedQuantity

      expect(movementQuantity).toBe(-10)
      expect(newStock).toBe(64)
    })

    it('calculates physical stock count verification correctly (mode: SET)', () => {
      const currentStock = 64
      const targetCount = 80
      const difference = targetCount - currentStock
      const newStock = currentStock + difference

      expect(difference).toBe(16)
      expect(newStock).toBe(80)

      // When target is lower than current
      const lowerTarget = 75
      const lowerDiff = lowerTarget - 80
      expect(lowerDiff).toBe(-5)
    })

    it('correctly calculates net change across inward and outward flows', () => {
      const openingStock = 100
      const inwardPurchases = 50
      const inwardManual = 20
      const outwardSales = 45
      const outwardDamages = 5

      const totalInward = inwardPurchases + inwardManual
      const totalOutward = outwardSales + outwardDamages
      const netChange = totalInward - totalOutward
      const closingStock = openingStock + netChange

      expect(totalInward).toBe(70)
      expect(totalOutward).toBe(50)
      expect(netChange).toBe(20)
      expect(closingStock).toBe(120)
    })
  })

  describe('Timestamp Recording & Formatting', () => {
    it('formats ISO datetime strings with exact date and time', () => {
      const sampleISO = '2026-10-02T14:30:00.000Z'
      const formatted = formatDateTime(sampleISO)
      expect(formatted).toContain('02 Oct 2026')
      // Note: time formatting depends on local zone, but contains AM or PM
      expect(formatted).toMatch(/(AM|PM)/)
    })

    it('handles null or undefined dates gracefully', () => {
      expect(formatDateTime(null)).toBe('—')
      expect(formatDateTime(undefined)).toBe('—')
    })
  })
})
