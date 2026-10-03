/**
 * ORION Authentication and Multi-Business Service
 * 
 * Provides:
 * - Secure password hashing via Web Crypto API (SHA-256 + salt)
 * - Master Admin bootstrapping
 * - Login validation and role-based access
 * - Business profile creation with owner credentials
 * - Password reset & account status toggling for Admin
 */

import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { seedDefaultTaxRates, seedDefaultUnits } from './product.service'
import { recordAuditEvent } from './audit.service'
import { getBusiness, rowToBusiness } from './business.service'
import type { User, UserRole, BusinessWithOwner } from '@/types/user'
import type { Business } from '@/types/business'

const PASSWORD_SALT = 'orion_desktop_salt_2026_secure'

/** Hash a plain text password with SHA-256 and constant salt */
export async function hashPassword(plain: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${plain}:${PASSWORD_SALT}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    name: r.name as string,
    email: r.email as string | null,
    role: (r.role as UserRole) || 'owner',
    isActive: Boolean(r.is_active),
    lastLoginAt: r.last_login_at as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

/**
 * Ensures Master Admin and default system accounts exist on startup.
 * Default admin credentials: Login ID: 'admin' / Password: 'admin123'
 */
export async function seedMasterAdminIfMissing(): Promise<void> {
  const now = nowISO()

  // Ensure system admin business exists
  await dbExecute(
    `INSERT INTO business (id, name, invoice_prefix, created_at, updated_at)
     VALUES ('biz_system_admin', 'ORION Master Administration', 'ADM', ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [now, now],
  )

  // Check if any admin exists
  const admins = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM users WHERE role = 'admin' LIMIT 1`,
    [],
  )

  if (admins.length === 0) {
    const adminHash = await hashPassword('admin123')
    await dbExecute(
      `INSERT INTO users (id, business_id, name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ('usr_master_admin', 'biz_system_admin', 'Administrator', 'admin', ?, 'admin', 1, ?, ?)`,
      [adminHash, now, now],
    )
    console.log('[ORION Auth] Master admin seeded: Login ID: admin / Password: admin123')
  }

  // Ensure any existing non-admin business has an owner user so they can log in
  const existingBusinesses = await dbSelect<Record<string, unknown>>(
    `SELECT b.* FROM business b
     LEFT JOIN users u ON u.business_id = b.id AND u.role = 'owner'
     WHERE b.id != 'biz_system_admin' AND u.id IS NULL`,
    [],
  )

  for (const b of existingBusinesses) {
    const bizId = b.id as string
    const bizName = b.name as string
    const loginId = (b.email as string) || bizName.toLowerCase().replace(/[^a-z0-9]/g, '') || `biz_${bizId.slice(0, 4)}`
    const defaultHash = await hashPassword('owner123')
    const userId = generateId()

    await dbExecute(
      `INSERT INTO users (id, business_id, name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'owner', 1, ?, ?)`,
      [userId, bizId, bizName, loginId, defaultHash, now, now],
    )
    console.log(`[ORION Auth] Created default owner user for existing business "${bizName}": Login ID: ${loginId}`)
  }
}

/** Authenticate user by Login ID (email/username) and Password */
export async function authenticateUser(
  loginId: string,
  plainPassword: string,
): Promise<{ success: boolean; error?: string; user?: User; business?: Business }> {
  const trimmed = loginId.trim()
  if (!trimmed || !plainPassword) {
    return { success: false, error: 'Login ID and password are required' }
  }

  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1`,
    [trimmed, trimmed],
  )

  if (rows.length === 0) {
    return { success: false, error: 'Invalid Login ID or Password' }
  }

  const userRow = rows[0]
  const user = rowToUser(userRow)

  if (!user.isActive) {
    return { success: false, error: 'This account has been deactivated. Please contact the administrator.' }
  }

  const hashedInput = await hashPassword(plainPassword)
  const storedHash = userRow.password_hash as string

  if (hashedInput !== storedHash) {
    return { success: false, error: 'Invalid Login ID or Password' }
  }

  // Update last_login_at
  const now = nowISO()
  await dbExecute(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`, [now, now, user.id])

  // Fetch linked business
  const business = await getBusiness(user.businessId)
  if (!business && user.role !== 'admin') {
    return { success: false, error: 'Associated business profile could not be found.' }
  }

  return { success: true, user, business: business || undefined }
}

export interface CreateBusinessProfileInput {
  businessName: string
  ownerName: string
  loginId: string
  password: string
  gstin?: string
  pan?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  stateCode?: string
  pin?: string
  invoicePrefix?: string
  bankName?: string
  accountNumber?: string
  ifsc?: string
  upiId?: string
}

/**
 * Creates a complete business profile along with owner user credentials.
 * Automatically seeds standard GST tax rates and measuring units for the new business.
 */
export async function createBusinessWithOwner(
  input: CreateBusinessProfileInput,
): Promise<{ business: Business; user: User; plainPassword: string }> {
  const bName = input.businessName.trim()
  const oName = input.ownerName.trim()
  const loginId = input.loginId.trim()
  const plainPassword = input.password.trim()

  if (!bName) throw new Error('Business name is required')
  if (!oName) throw new Error('Owner name is required')
  if (!loginId) throw new Error('Login ID is required')
  if (!plainPassword || plainPassword.length < 4) throw new Error('Password must be at least 4 characters')

  // Check if a business with this name already exists
  const existingBizRows = await dbSelect<Record<string, unknown>>(
    `SELECT id FROM business WHERE LOWER(name) = LOWER(?) AND id != 'biz_system_admin' LIMIT 1`,
    [bName],
  )

  let businessId = existingBizRows.length > 0 ? (existingBizRows[0].id as string) : generateId()
  let userId = generateId()
  const now = nowISO()
  const hashedPassword = await hashPassword(plainPassword)

  await dbTransaction(async (tx) => {
    if (existingBizRows.length > 0) {
      // Update existing business profile
      await tx.execute(
        `UPDATE business
         SET name = ?, address = ?, city = ?, state = ?, state_code = ?, pin = ?,
             phone = ?, email = ?, gstin = ?, pan = ?, bank_name = ?,
             account_number = ?, ifsc = ?, upi_id = ?, invoice_prefix = ?, updated_at = ?
         WHERE id = ?`,
        [
          bName,
          input.address ?? null,
          input.city ?? null,
          input.state ?? null,
          input.stateCode ?? null,
          input.pin ?? null,
          input.phone ?? null,
          input.email ?? null,
          input.gstin ?? null,
          input.pan ?? null,
          input.bankName ?? null,
          input.accountNumber ?? null,
          input.ifsc ?? null,
          input.upiId ?? null,
          input.invoicePrefix?.toUpperCase() || 'INV',
          now,
          businessId,
        ],
      )
    } else {
      // 1. Insert new business
      await tx.execute(
        `INSERT INTO business
         (id, name, address, city, state, state_code, pin, phone, email,
          gstin, pan, bank_name, account_number, ifsc, upi_id, invoice_prefix,
          financial_year_start, terms_and_conditions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4, 'Thank you for your business.', ?, ?)`,
        [
          businessId,
          bName,
          input.address ?? null,
          input.city ?? null,
          input.state ?? null,
          input.stateCode ?? null,
          input.pin ?? null,
          input.phone ?? null,
          input.email ?? null,
          input.gstin ?? null,
          input.pan ?? null,
          input.bankName ?? null,
          input.accountNumber ?? null,
          input.ifsc ?? null,
          input.upiId ?? null,
          input.invoicePrefix?.toUpperCase() || 'INV',
          now,
          now,
        ],
      )
    }

    // 2. Upsert owner user
    const existingUsers = await tx.select<Record<string, unknown>>(
      `SELECT id FROM users WHERE business_id = ? OR LOWER(email) = LOWER(?) LIMIT 1`,
      [businessId, loginId],
    )

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id as string
      await tx.execute(
        `UPDATE users
         SET business_id = ?, name = ?, email = ?, password_hash = ?, role = 'owner', is_active = 1, updated_at = ?
         WHERE id = ?`,
        [businessId, oName, loginId, hashedPassword, now, userId],
      )
    } else {
      await tx.execute(
        `INSERT INTO users
         (id, business_id, name, email, password_hash, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'owner', 1, ?, ?)`,
        [userId, businessId, oName, loginId, hashedPassword, now, now],
      )
    }
  })

  // 3. Seed default tax rates & units if new
  if (existingBizRows.length === 0) {
    await seedDefaultTaxRates(businessId)
    await seedDefaultUnits(businessId)
  }

  // 4. Mark setup as complete and update license client name
  await dbExecute(`UPDATE app_settings SET value = '1', updated_at = ? WHERE key = 'setup_complete'`, [now])
  await dbExecute(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'license_client_name'`, [bName, now])

  // 5. Audit trail
  await recordAuditEvent({
    businessId,
    action: existingBizRows.length > 0 ? 'UPDATED' : 'CREATED',
    entityType: 'BUSINESS',
    entityId: businessId,
    newValues: { name: bName, owner: oName, loginId },
  })

  const business = (await getBusiness(businessId))!
  const user: User = {
    id: userId,
    businessId,
    name: oName,
    email: loginId,
    role: 'owner',
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  }

  return { business, user, plainPassword }
}

/** Lists all registered businesses with their associated owner info and statistics */
export async function listAllBusinessesWithOwners(): Promise<BusinessWithOwner[]> {
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT 
       b.*,
       u.id as user_id,
       u.name as owner_name,
       u.email as owner_login_id,
       u.is_active as user_active,
       u.last_login_at as owner_last_login,
       (SELECT COUNT(*) FROM invoices i WHERE i.business_id = b.id) as invoice_count,
       (SELECT COALESCE(SUM(total_amount), 0) FROM invoices i WHERE i.business_id = b.id AND i.status != 'CANCELLED') as total_revenue
     FROM business b
     LEFT JOIN users u ON u.business_id = b.id AND u.role = 'owner'
     WHERE b.id != 'biz_system_admin'
     ORDER BY b.created_at DESC`,
    [],
  )

  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    invoicePrefix: (r.invoice_prefix as string) || 'INV',
    phone: r.phone as string | null,
    email: r.email as string | null,
    address: r.address as string | null,
    city: r.city as string | null,
    state: r.state as string | null,
    stateCode: r.state_code as string | null,
    pin: r.pin as string | null,
    gstin: r.gstin as string | null,
    pan: r.pan as string | null,
    bankName: r.bank_name as string | null,
    accountNumber: r.account_number as string | null,
    ifsc: r.ifsc as string | null,
    upiId: r.upi_id as string | null,
    termsAndConditions: r.terms_and_conditions as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    userId: r.user_id as string | null,
    ownerName: r.owner_name as string | null,
    ownerLoginId: r.owner_login_id as string | null,
    userActive: r.user_active !== null ? Boolean(r.user_active) : true,
    ownerLastLogin: r.owner_last_login as string | null,
    invoiceCount: Number(r.invoice_count || 0),
    totalRevenue: Number(r.total_revenue || 0),
  }))
}

/** Admin resets a business owner's password */
export async function resetOwnerPassword(userId: string, newPassword: string): Promise<void> {
  const trimmed = newPassword.trim()
  if (!trimmed || trimmed.length < 4) {
    throw new Error('New password must be at least 4 characters long')
  }

  const hash = await hashPassword(trimmed)
  const now = nowISO()
  await dbExecute(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [hash, now, userId])
}

/** Admin changes their own password */
export async function updateAdminPassword(adminId: string, newPassword: string): Promise<void> {
  const trimmed = newPassword.trim()
  if (!trimmed || trimmed.length < 4) {
    throw new Error('New password must be at least 4 characters long')
  }

  const hash = await hashPassword(trimmed)
  const now = nowISO()
  await dbExecute(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND role = 'admin'`, [hash, now, adminId])
}

/** Admin changes their own login ID and/or password */
export async function updateAdminCredentials(
  adminId: string,
  newLoginId: string,
  newPassword?: string,
): Promise<void> {
  const loginTrimmed = newLoginId.trim()
  if (!loginTrimmed) {
    throw new Error('Login ID cannot be empty')
  }

  const now = nowISO()
  if (newPassword && newPassword.trim()) {
    const passTrimmed = newPassword.trim()
    if (passTrimmed.length < 4) {
      throw new Error('New password must be at least 4 characters long')
    }
    const hash = await hashPassword(passTrimmed)
    await dbExecute(
      `UPDATE users SET email = ?, password_hash = ?, updated_at = ? WHERE id = ? AND role = 'admin'`,
      [loginTrimmed, hash, now, adminId],
    )
  } else {
    await dbExecute(
      `UPDATE users SET email = ?, updated_at = ? WHERE id = ? AND role = 'admin'`,
      [loginTrimmed, now, adminId],
    )
  }
}

/** Toggle a user's active status (activate/deactivate) */
export async function toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
  const now = nowISO()
  await dbExecute(`UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?`, [isActive ? 1 : 0, now, userId])
}

/** Delete a business and all linked records */
export async function deleteBusiness(businessId: string): Promise<void> {
  if (businessId === 'biz_system_admin') {
    throw new Error('Cannot delete system administration profile')
  }
  await dbExecute(`DELETE FROM business WHERE id = ?`, [businessId])
}

const MASTER_VENDOR_SALT = 'ORION_VENDOR_MASTER_SECURITY_KEY_2026'

/**
 * Validates the Master Vendor Passkey.
 * Default Master Passkey: 'ORION-MASTER-2026'
 */
export async function verifyMasterVendorPasskey(inputPasskey: string): Promise<boolean> {
  const trimmed = inputPasskey.trim()
  if (!trimmed) return false

  const rows = await dbSelect<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'master_vendor_passkey_hash' LIMIT 1`,
    [],
  )

  const inputHash = await hashPassword(`${trimmed}:${MASTER_VENDOR_SALT}`)

  if (rows.length > 0 && rows[0].value) {
    return inputHash === rows[0].value
  }

  // Default master passkey
  const defaultHash = await hashPassword(`ORION-MASTER-2026:${MASTER_VENDOR_SALT}`)
  return inputHash === defaultHash
}

/**
 * Unlocks the Master Admin session using the Master Vendor Passkey.
 */
export async function unlockMasterAdminWithPasskey(passkey: string): Promise<{
  success: boolean
  error?: string
  user?: User
}> {
  const isValid = await verifyMasterVendorPasskey(passkey)
  if (!isValid) {
    return { success: false, error: 'Invalid Master Vendor Passkey. Access denied.' }
  }

  const now = nowISO()

  await dbExecute(
    `INSERT INTO business (id, name, invoice_prefix, created_at, updated_at)
     VALUES ('biz_system_admin', 'ORION Master Administration', 'ADM', ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [now, now],
  )

  const admins = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM users WHERE role = 'admin' LIMIT 1`,
    [],
  )

  let adminUser: User
  if (admins.length > 0) {
    adminUser = rowToUser(admins[0])
  } else {
    const adminId = 'usr_master_admin'
    const randomHash = await hashPassword(generateId())
    await dbExecute(
      `INSERT INTO users (id, business_id, name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, 'biz_system_admin', 'Administrator', 'admin', ?, 'admin', 1, ?, ?)`,
      [adminId, randomHash, now, now],
    )
    adminUser = {
      id: adminId,
      businessId: 'biz_system_admin',
      name: 'Administrator',
      email: 'admin',
      role: 'admin',
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    }
  }

  return { success: true, user: adminUser }
}

/**
 * Updates the Master Vendor Passkey
 */
export async function changeMasterVendorPasskey(newPasskey: string): Promise<void> {
  const trimmed = newPasskey.trim()
  if (!trimmed || trimmed.length < 6) {
    throw new Error('Master Vendor Passkey must be at least 6 characters long')
  }
  const hash = await hashPassword(`${trimmed}:${MASTER_VENDOR_SALT}`)
  const now = nowISO()
  await dbExecute(
    `INSERT INTO app_settings (id, key, value, description, updated_at)
     VALUES ('aset_vendor_passkey', 'master_vendor_passkey_hash', ?, 'Hash of master vendor passkey', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [hash, now],
  )
}

