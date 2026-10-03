/**
 * ORION Business Service
 * Manages business profile and app settings.
 */
import { dbSelect, dbExecute, dbTransaction } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { recordAuditEvent } from './audit.service'
import { seedDefaultTaxRates, seedDefaultUnits } from './product.service'
import type { Business, BusinessFormData, AppSettingKey } from '@/types/business'

export function rowToBusiness(r: Record<string, unknown>): Business {
  return {
    id: r.id as string,
    name: r.name as string,
    logoPath: r.logo_path as string | null,
    address: r.address as string | null,
    city: r.city as string | null,
    state: r.state as string | null,
    stateCode: r.state_code as string | null,
    pin: r.pin as string | null,
    phone: r.phone as string | null,
    email: r.email as string | null,
    website: r.website as string | null,
    gstin: r.gstin as string | null,
    pan: r.pan as string | null,
    bankName: r.bank_name as string | null,
    accountNumber: r.account_number as string | null,
    ifsc: r.ifsc as string | null,
    upiId: r.upi_id as string | null,
    invoicePrefix: (r.invoice_prefix as string) ?? 'INV',
    financialYearStart: (r.financial_year_start as number) ?? 4,
    signaturePath: r.signature_path as string | null,
    termsAndConditions: r.terms_and_conditions as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

/** Get a business record by ID, or the business matching active license, or latest active business */
export async function getBusiness(id?: string): Promise<Business | null> {
  if (id) {
    const rows = await dbSelect<Record<string, unknown>>(
      `SELECT * FROM business WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows.length > 0 ? rowToBusiness(rows[0]) : null
  }

  // 1. Prioritize business matching current activated license client name
  const licClient = await getAppSetting('license_client_name')
  if (licClient && licClient.trim()) {
    const matched = await dbSelect<Record<string, unknown>>(
      `SELECT * FROM business WHERE id != 'biz_system_admin' AND LOWER(name) = LOWER(?) ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
      [licClient.trim()],
    )
    if (matched.length > 0) {
      return rowToBusiness(matched[0])
    }
  }

  // 2. Fall back to most recently updated / created business
  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM business WHERE id != 'biz_system_admin' ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
    [],
  )
  return rows.length > 0 ? rowToBusiness(rows[0]) : null
}

/** Create the initial business profile during setup wizard. */
export async function createBusiness(data: BusinessFormData): Promise<Business> {
  const id = generateId()
  const now = nowISO()

  await dbTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO business
       (id, name, logo_path, address, city, state, state_code, pin, phone, email, website,
        gstin, pan, bank_name, account_number, ifsc, upi_id, invoice_prefix,
        financial_year_start, signature_path, terms_and_conditions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.name, data.logoPath ?? null, data.address ?? null, data.city ?? null,
        data.state ?? null, data.stateCode ?? null, data.pin ?? null, data.phone ?? null,
        data.email ?? null, data.website ?? null, data.gstin ?? null, data.pan ?? null,
        data.bankName ?? null, data.accountNumber ?? null, data.ifsc ?? null,
        data.upiId ?? null, data.invoicePrefix ?? 'INV', data.financialYearStart ?? 4,
        data.signaturePath ?? null, data.termsAndConditions ?? null, now, now,
      ],
    )

    await tx.execute(
      `UPDATE app_settings SET value = '1', updated_at = ? WHERE key = 'setup_complete'`,
      [now],
    )
  })

  // Seed default data for the new business
  await seedDefaultTaxRates(id)
  await seedDefaultUnits(id)

  await recordAuditEvent({
    businessId: id,
    action: 'CREATED',
    entityType: 'BUSINESS',
    entityId: id,
    newValues: { name: data.name },
  })

  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM business WHERE id = ?`, [id]
  )
  return rowToBusiness(rows[0])
}

export async function updateBusiness(id: string, data: Partial<BusinessFormData>): Promise<Business> {
  const now = nowISO()
  const fieldMap: Record<string, string> = {
    name: 'name', logoPath: 'logo_path', address: 'address', city: 'city',
    state: 'state', stateCode: 'state_code', pin: 'pin', phone: 'phone',
    email: 'email', website: 'website', gstin: 'gstin', pan: 'pan',
    bankName: 'bank_name', accountNumber: 'account_number', ifsc: 'ifsc',
    upiId: 'upi_id', invoicePrefix: 'invoice_prefix',
    financialYearStart: 'financial_year_start', signaturePath: 'signature_path',
    termsAndConditions: 'terms_and_conditions',
  }

  const setClauses: string[] = []
  const params: unknown[] = []

  for (const [jsKey, sqlKey] of Object.entries(fieldMap)) {
    if (jsKey in data) {
      setClauses.push(`${sqlKey} = ?`)
      params.push((data as Record<string, unknown>)[jsKey])
    }
  }

  setClauses.push('updated_at = ?')
  params.push(now, id)

  await dbExecute(
    `UPDATE business SET ${setClauses.join(', ')} WHERE id = ?`,
    params,
  )

  await recordAuditEvent({
    businessId: id,
    action: 'UPDATED',
    entityType: 'BUSINESS',
    entityId: id,
    newValues: data as Record<string, unknown>,
  })

  const rows = await dbSelect<Record<string, unknown>>(
    `SELECT * FROM business WHERE id = ?`, [id]
  )
  return rowToBusiness(rows[0])
}

export async function getAppSetting(key: AppSettingKey): Promise<string | null> {
  const rows = await dbSelect<{ value: string | null }>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [key],
  )
  return rows[0]?.value ?? null
}

export async function setAppSetting(key: AppSettingKey, value: string): Promise<void> {
  await dbExecute(
    `INSERT INTO app_settings (id, key, value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [generateId(), key, value, nowISO()],
  )
}

export async function isSetupComplete(): Promise<boolean> {
  const value = await getAppSetting('setup_complete')
  if (value !== '1') return false

  // Verify that an active business profile exists for this installation
  const biz = await getBusiness()
  if (!biz) return false

  // Verify that an owner user exists with credentials for this business
  const users = await dbSelect<Record<string, unknown>>(
    `SELECT id FROM users WHERE business_id = ? AND role = 'owner' LIMIT 1`,
    [biz.id],
  )
  return users.length > 0
}
