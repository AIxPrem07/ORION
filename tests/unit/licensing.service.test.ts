import { describe, it, expect, vi } from 'vitest'
import {
  generateProductKey,
  verifyProductKey,
  normalizeClientName,
  activateSoftwareLicense,
} from '@/services/licensing.service'

// Mock db client for testing
vi.mock('@db/client', () => {
  const store = new Map<string, string>()
  const productKeys: any[] = []

  return {
    dbExecute: vi.fn(async (sql: string, params: any[] = []) => {
      if (sql.includes('INSERT INTO product_keys')) {
        productKeys.push({
          id: params[0],
          product_key: params[1],
          client_name: params[2],
        })
      }
      if (sql.includes('UPDATE app_settings')) {
        // e.g. params[0] is value
        const keyMatch = sql.match(/key = '([^']+)'/)
        if (keyMatch) {
          store.set(keyMatch[1], params[0])
        }
      }
      return { rowsAffected: 1 }
    }),
    dbSelect: vi.fn(async (sql: string) => {
      if (sql.includes('device_fingerprint')) {
        return [{ value: 'DEV-TEST-1234-5678' }]
      }
      if (sql.includes("key LIKE 'license_%'")) {
        return Array.from(store.entries()).map(([key, value]) => ({ key, value }))
      }
      return []
    }),
  }
})

describe('Offline Product Key & Licensing Service', () => {
  it('normalizes client business names correctly', () => {
    expect(normalizeClientName('Shree Ram Traders & Co.')).toBe('SHREERAMTRADERSCO')
    expect(normalizeClientName('Balaji Garments 123')).toBe('BALAJIGARMENTS123')
  })

  it('generates a valid, cryptographically signed Product Key for Lifetime Pro', async () => {
    const keyRecord = await generateProductKey({
      clientName: 'Balaji Garments',
      plan: 'lifetime',
      edition: 'pro',
    })

    expect(keyRecord.productKey).toMatch(/^ORION-PRO-L[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/)
    expect(keyRecord.clientName).toBe('Balaji Garments')
    expect(keyRecord.plan).toBe('lifetime')
  })

  it('verifies a genuine Product Key offline with matching client name', async () => {
    const keyRecord = await generateProductKey({
      clientName: 'Sharma Textiles',
      plan: 'lifetime',
      edition: 'pro',
    })

    const result = await verifyProductKey(keyRecord.productKey, 'Sharma Textiles')
    expect(result.valid).toBe(true)
    expect(result.license?.plan).toBe('lifetime')
    expect(result.license?.edition).toBe('pro')
  })

  it('rejects an authentic Product Key if client name does not match', async () => {
    const keyRecord = await generateProductKey({
      clientName: 'Sharma Textiles',
      plan: 'lifetime',
      edition: 'pro',
    })

    const result = await verifyProductKey(keyRecord.productKey, 'Different Company Ltd')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('was not issued for "Different Company Ltd"')
  })

  it('rejects forged or modified Product Keys', async () => {
    const keyRecord = await generateProductKey({
      clientName: 'Apex Industries',
      plan: 'lifetime',
      edition: 'pro',
    })

    // Alter one character in signature
    const parts = keyRecord.productKey.split('-')
    const alteredSigPart = parts[5].replace(/[0-9A-F]/, 'Z')
    const forgedKey = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${alteredSigPart}`

    const result = await verifyProductKey(forgedKey, 'Apex Industries')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Checksum verification failed')
  })

  it('activates software license successfully and stores in settings', async () => {
    const keyRecord = await generateProductKey({
      clientName: 'Patel Electronics',
      plan: '1year',
      edition: 'enterprise',
    })

    const activation = await activateSoftwareLicense(keyRecord.productKey, 'Patel Electronics')
    expect(activation.success).toBe(true)
    expect(activation.license?.isActivated).toBe(true)
    expect(activation.license?.plan).toBe('1year')
    expect(activation.license?.edition).toBe('enterprise')
  })
})
