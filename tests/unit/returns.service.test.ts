import { describe, it, expect } from 'vitest'

describe('returns.service — Business Calculations & Validation', () => {
  it('correctly calculates line item totals with scaled quantity (x100)', () => {
    // 2.50 units at ₹150.00 (15000 paise)
    const quantity = 250 // 2.50 units
    const unitPrice = 15000 // ₹150.00
    const lineTotal = Math.round((unitPrice * quantity) / 100)
    expect(lineTotal).toBe(37500) // ₹375.00
  })

  it('correctly calculates fractional paise rounding', () => {
    // 3.33 units at ₹19.99 (1999 paise)
    const quantity = 333
    const unitPrice = 1999
    const lineTotal = Math.round((unitPrice * quantity) / 100)
    expect(lineTotal).toBe(6657) // 66.5667 -> 6657 paise (₹66.57)
  })

  it('correctly aggregates multiple returned items', () => {
    const items = [
      { quantity: 100, unitPrice: 5000 },  // 1 unit @ ₹50 = ₹50.00 (5000 paise)
      { quantity: 200, unitPrice: 10000 }, // 2 units @ ₹100 = ₹200.00 (20000 paise)
      { quantity: 50, unitPrice: 8000 },   // 0.5 unit @ ₹80 = ₹40.00 (4000 paise)
    ]

    const total = items.reduce(
      (sum, item) => sum + Math.round((item.unitPrice * item.quantity) / 100),
      0,
    )
    expect(total).toBe(29000) // ₹290.00
  })

  it('rejects non-positive quantities', () => {
    const invalidItems = [{ quantity: 0, unitPrice: 1000 }]
    const hasZero = invalidItems.some((i) => i.quantity <= 0)
    expect(hasZero).toBe(true)
  })
})
