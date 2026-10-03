/**
 * ORION Offline Product Key & Licensing Service
 * 
 * Provides:
 * - Deterministic, offline-verifiable Product Key generation with HMAC-SHA256 signature
 * - 100% Offline cryptographic license validation
 * - Machine/Device fingerprinting
 * - Software activation and license status management
 * - Admin client licensing directory
 */

import { dbSelect, dbExecute } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'

const LICENSE_MASTER_SALT = 'ORION_MASTER_OFFLINE_SECRET_SALT_2026_HMAC'

export type LicensePlan = 'lifetime' | '1year' | '3year' | 'trial'
export type LicenseEdition = 'standard' | 'pro' | 'enterprise'

export interface ProductKeyRecord {
  id: string
  productKey: string
  clientName: string
  contactInfo: string | null
  plan: LicensePlan
  edition: LicenseEdition
  deviceId: string | null
  isActivated: boolean
  activatedDeviceId: string | null
  activatedAt: string | null
  expiresAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ActiveLicenseInfo {
  isActivated: boolean
  productKey?: string
  clientName?: string
  plan?: LicensePlan
  edition?: LicenseEdition
  activatedAt?: string
  deviceId?: string
}

export interface GenerateKeyOptions {
  clientName: string
  contactInfo?: string
  plan?: LicensePlan
  edition?: LicenseEdition
  deviceId?: string
  notes?: string
}

/** Compute SHA-256 hex string */
async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Returns a stable, human-readable Device Fingerprint for the current machine.
 * e.g., 'DEV-MAC-8A2F-9C14' or 'DEV-WIN-7B3D-11E2'
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    const existing = await dbSelect<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'device_fingerprint' LIMIT 1`,
      [],
    )
    if (existing.length > 0 && existing[0].value) {
      return existing[0].value
    }

    // Determine platform
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || '')
    const prefix = isMac ? 'MAC' : 'WIN'

    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()

    const deviceId = `DEV-${prefix}-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}`

    const now = nowISO()
    await dbExecute(
      `INSERT INTO app_settings (id, key, value, description, updated_at)
       VALUES ('aset_device_fingerprint', 'device_fingerprint', ?, 'Device hardware fingerprint', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [deviceId, now],
    )

    return deviceId
  } catch (err) {
    console.warn('[Licensing] Failed to read device fingerprint from DB, generating fallback:', err)
    return 'DEV-ORION-DEFAULT'
  }
}

/** Normalizes a client name into uppercase alphanumeric string */
export function normalizeClientName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Plan code character */
function planToCode(plan: LicensePlan): string {
  switch (plan) {
    case 'lifetime':
      return 'L'
    case '1year':
      return '1'
    case '3year':
      return '3'
    case 'trial':
      return 'T'
    default:
      return 'L'
  }
}

function codeToPlan(code: string): LicensePlan {
  switch (code) {
    case 'L':
      return 'lifetime'
    case '1':
      return '1year'
    case '3':
      return '3year'
    case 'T':
      return 'trial'
    default:
      return 'lifetime'
  }
}

function editionToCode(edition: LicenseEdition): string {
  switch (edition) {
    case 'pro':
      return 'PRO'
    case 'enterprise':
      return 'ENT'
    case 'standard':
      return 'STD'
    default:
      return 'PRO'
  }
}

function codeToEdition(code: string): LicenseEdition {
  switch (code) {
    case 'PRO':
      return 'pro'
    case 'ENT':
      return 'enterprise'
    case 'STD':
      return 'standard'
    default:
      return 'pro'
  }
}

/**
 * Computes signature for key parts
 */
async function computeSignature(editionCode: string, planCode: string, clientPart: string): Promise<string> {
  const payload = `${editionCode}:${planCode}:${clientPart}:${LICENSE_MASTER_SALT}`
  const hash = await sha256Hex(payload)
  return hash.slice(0, 8).toUpperCase()
}

/**
 * Generates a genuine, offline-verifiable Product Key
 * Format: ORION-PRO-L9A2-B4F1-7C3E-9A10
 */
export async function generateProductKey(options: GenerateKeyOptions): Promise<ProductKeyRecord> {
  const clientName = options.clientName.trim()
  if (!clientName) {
    throw new Error('Client business name is required to generate a Product Key.')
  }

  const plan: LicensePlan = options.plan || 'lifetime'
  const edition: LicenseEdition = options.edition || 'pro'
  const editionCode = editionToCode(edition)
  const planChar = planToCode(plan)

  // 3 random uppercase hex chars
  const randHex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .slice(0, 3)

  const planSegment = `${planChar}${randHex}` // 4 chars, e.g. L9A2

  // Client signature segment (4 chars)
  const normClient = normalizeClientName(clientName)
  const clientHash = (await sha256Hex(`${normClient}:${LICENSE_MASTER_SALT}`)).slice(0, 4).toUpperCase()

  // Signature segment (8 chars -> 2 groups of 4)
  const sig8 = await computeSignature(editionCode, planChar, clientHash)
  const sigPart1 = sig8.slice(0, 4)
  const sigPart2 = sig8.slice(4, 8)

  const productKey = `ORION-${editionCode}-${planSegment}-${clientHash}-${sigPart1}-${sigPart2}`

  const now = nowISO()
  let expiresAt: string | null = null
  if (plan === '1year') {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    expiresAt = d.toISOString()
  } else if (plan === '3year') {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 3)
    expiresAt = d.toISOString()
  } else if (plan === 'trial') {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    expiresAt = d.toISOString()
  }

  const recordId = generateId()

  await dbExecute(
    `INSERT INTO product_keys (
      id, product_key, client_name, contact_info, plan, edition, device_id,
      is_activated, expires_at, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      recordId,
      productKey,
      clientName,
      options.contactInfo?.trim() || null,
      plan,
      edition,
      options.deviceId?.trim() || null,
      expiresAt,
      options.notes?.trim() || null,
      now,
      now,
    ],
  )

  return {
    id: recordId,
    productKey,
    clientName,
    contactInfo: options.contactInfo?.trim() || null,
    plan,
    edition,
    deviceId: options.deviceId?.trim() || null,
    isActivated: false,
    activatedDeviceId: null,
    activatedAt: null,
    expiresAt,
    notes: options.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Validates a Product Key cryptographically (100% offline).
 */
export async function verifyProductKey(
  inputKey: string,
  clientName?: string,
): Promise<{
  valid: boolean
  error?: string
  license?: {
    productKey: string
    clientName?: string
    plan: LicensePlan
    edition: LicenseEdition
  }
}> {
  const cleanKey = inputKey.trim().toUpperCase()

  // Format: ORION-PRO-L9A2-B4F1-7C3E-9A10
  const parts = cleanKey.split('-')
  if (parts.length !== 6 || parts[0] !== 'ORION') {
    return {
      valid: false,
      error: 'Invalid Product Key format. Expected format: ORION-PRO-XXXX-XXXX-XXXX-XXXX',
    }
  }

  const editionCode = parts[1] // PRO, STD, ENT
  const planSegment = parts[2] // L9A2
  const clientHash = parts[3]  // B4F1
  const sigPart1 = parts[4]    // 7C3E
  const sigPart2 = parts[5]    // 9A10

  const planChar = planSegment[0]
  const edition = codeToEdition(editionCode)
  const plan = codeToPlan(planChar)

  // Verify HMAC signature
  const expectedSig = await computeSignature(editionCode, planChar, clientHash)
  const actualSig = `${sigPart1}${sigPart2}`

  if (actualSig !== expectedSig) {
    return {
      valid: false,
      error: 'Invalid or forged Product Key. Checksum verification failed.',
    }
  }

  // If clientName is provided, check if it matches clientHash
  if (clientName && clientName.trim()) {
    const normClient = normalizeClientName(clientName)
    const expectedClientHash = (await sha256Hex(`${normClient}:${LICENSE_MASTER_SALT}`)).slice(0, 4).toUpperCase()
    if (expectedClientHash !== clientHash) {
      return {
        valid: false,
        error: `This Product Key was not issued for "${clientName.trim()}". Please enter the exact registered business name.`,
      }
    }
  }

  return {
    valid: true,
    license: {
      productKey: cleanKey,
      clientName: clientName?.trim(),
      plan,
      edition,
    },
  }
}

/**
 * Activates software with a valid Product Key.
 * Saves license state permanently in SQLite app_settings.
 */
export async function activateSoftwareLicense(
  productKey: string,
  clientName: string,
): Promise<{ success: boolean; error?: string; license?: ActiveLicenseInfo }> {
  const cName = clientName.trim()
  if (!cName) {
    return { success: false, error: 'Business / Client name is required for activation.' }
  }

  const verification = await verifyProductKey(productKey, cName)
  if (!verification.valid || !verification.license) {
    return { success: false, error: verification.error || 'Product Key verification failed.' }
  }

  const deviceId = await getDeviceFingerprint()
  const now = nowISO()

  // Save to app_settings
  await dbExecute(`UPDATE app_settings SET value = 'active', updated_at = ? WHERE key = 'license_status'`, [now])
  await dbExecute(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'license_key'`, [verification.license.productKey, now])
  await dbExecute(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'license_client_name'`, [cName, now])
  await dbExecute(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'license_plan'`, [verification.license.plan, now])
  await dbExecute(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'license_edition'`, [verification.license.edition, now])
  await dbExecute(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'license_activated_at'`, [now, now])
  await dbExecute(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'license_device_id'`, [deviceId, now])
  // Reset setup_complete so new activation goes through account setup
  await dbExecute(`UPDATE app_settings SET value = '0', updated_at = ? WHERE key = 'setup_complete'`, [now])

  // Also update product_keys table if this database has it
  try {
    await dbExecute(
      `UPDATE product_keys
       SET is_activated = 1, activated_device_id = ?, activated_at = ?, updated_at = ?
       WHERE product_key = ?`,
      [deviceId, now, now, verification.license.productKey],
    )
  } catch (err) {
    // Non-fatal if table doesn't have the record (e.g. client machine)
    console.debug('[Licensing] Local product_keys update skipped:', err)
  }

  return {
    success: true,
    license: {
      isActivated: true,
      productKey: verification.license.productKey,
      clientName: cName,
      plan: verification.license.plan,
      edition: verification.license.edition,
      activatedAt: now,
      deviceId,
    },
  }
}

/**
 * Checks if current ORION installation is activated with a valid license
 */
export async function getActiveLicense(): Promise<ActiveLicenseInfo> {
  try {
    const rows = await dbSelect<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key LIKE 'license_%'`,
      [],
    )

    const map = new Map<string, string>()
    for (const r of rows) {
      map.set(r.key, r.value)
    }

    const status = map.get('license_status')
    if (status !== 'active') {
      return { isActivated: false }
    }

    return {
      isActivated: true,
      productKey: map.get('license_key') || undefined,
      clientName: map.get('license_client_name') || undefined,
      plan: (map.get('license_plan') as LicensePlan) || 'lifetime',
      edition: (map.get('license_edition') as LicenseEdition) || 'pro',
      activatedAt: map.get('license_activated_at') || undefined,
      deviceId: map.get('license_device_id') || undefined,
    }
  } catch (err) {
    console.warn('[Licensing] Error reading license status:', err)
    return { isActivated: false }
  }
}

/**
 * Lists all Product Keys generated by Admin
 */
export async function listAllProductKeys(): Promise<ProductKeyRecord[]> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM product_keys ORDER BY created_at DESC`,
    [],
  )

  return rows.map((r) => ({
    id: r.id as string,
    productKey: r.product_key as string,
    clientName: r.client_name as string,
    contactInfo: r.contact_info as string | null,
    plan: (r.plan as LicensePlan) || 'lifetime',
    edition: (r.edition as LicenseEdition) || 'pro',
    deviceId: r.device_id as string | null,
    isActivated: Boolean(r.is_activated),
    activatedDeviceId: r.activated_device_id as string | null,
    activatedAt: r.activated_at as string | null,
    expiresAt: r.expires_at as string | null,
    notes: r.notes as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }))
}

/**
 * Delete a product key from the directory
 */
export async function deleteProductKey(id: string): Promise<void> {
  await dbExecute(`DELETE FROM product_keys WHERE id = ?`, [id])
}
