import { describe, it, expect } from 'vitest'
import { hashPassword } from '@/services/auth.service'

describe('ORION Authentication Service Tests', () => {
  describe('hashPassword', () => {
    it('produces a 64-character SHA-256 hexadecimal hash', async () => {
      const hash = await hashPassword('admin123')
      expect(hash).toHaveLength(64)
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true)
    })

    it('is deterministic for identical inputs', async () => {
      const hash1 = await hashPassword('secure_password_99')
      const hash2 = await hashPassword('secure_password_99')
      expect(hash1).toBe(hash2)
    })

    it('produces completely different hashes for different passwords', async () => {
      const hash1 = await hashPassword('password1')
      const hash2 = await hashPassword('password2')
      expect(hash1).not.toBe(hash2)
    })
  })
})
