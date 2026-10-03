import { describe, it, expect } from 'vitest'
import { buildInvoiceNumber, padSequence } from '@/utils/format'

describe('Invoice Number Formatting', () => {
  it('pads sequence numbers correctly', () => {
    expect(padSequence(1, 4)).toBe('0001')
    expect(padSequence(42, 4)).toBe('0042')
    expect(padSequence(999, 4)).toBe('0999')
    expect(padSequence(1000, 4)).toBe('1000')
    expect(padSequence(12345, 4)).toBe('12345')
  })

  it('builds standard Indian invoice numbers with prefix, FY and sequence', () => {
    expect(buildInvoiceNumber('INV', '26-27', 1)).toBe('INV/26-27/0001')
    expect(buildInvoiceNumber('INV', '26-27', 42)).toBe('INV/26-27/0042')
    expect(buildInvoiceNumber('RET', '25-26', 15, 5)).toBe('RET/25-26/00015')
  })
})
