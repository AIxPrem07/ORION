/**
 * ORION Ledger Service
 * 
 * Creates and queries ledger entries.
 * Every financial transaction (invoice, payment, purchase) creates ledger entries.
 * 
 * Convention:
 * - Customer ledger: DEBIT when invoice created (customer owes us), CREDIT when payment received
 * - Supplier ledger: CREDIT when purchase created (we owe supplier), DEBIT when payment made
 * - Balance = running total from oldest to newest
 */
import { dbSelect, dbExecute } from '@db/client'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import type { LedgerEntry, LedgerFilter, LedgerSummary, LedgerReferenceType, LedgerPartyType } from '@/types/ledger'

export interface CreateLedgerEntryInput {
  businessId: string
  entryDate: string
  partyType?: LedgerPartyType
  partyId?: string
  referenceType: LedgerReferenceType
  referenceId?: string
  description: string
  debit: number   // paise
  credit: number  // paise
}

/**
 * Create a ledger entry and calculate running balance.
 * Must be called within the same transaction as the triggering financial operation.
 */
export async function createLedgerEntry(
  input: CreateLedgerEntryInput,
  tx?: { select: typeof dbSelect; execute: typeof dbExecute },
): Promise<LedgerEntry> {
  const executor = tx ?? { select: dbSelect, execute: dbExecute }

  // Get the last balance for this party
  let lastBalance = 0
  if (input.partyId && input.partyType) {
    const lastEntryRows = await executor.select<{ balance: number }>(
      `SELECT balance FROM ledger_entries
       WHERE business_id = ? AND party_type = ? AND party_id = ?
       ORDER BY entry_date DESC, created_at DESC
       LIMIT 1`,
      [input.businessId, input.partyType, input.partyId],
    )
    lastBalance = lastEntryRows[0]?.balance ?? 0
  }

  const balance = lastBalance + input.debit - input.credit
  const id = generateId()

  await executor.execute(
    `INSERT INTO ledger_entries
     (id, business_id, entry_date, party_type, party_id, reference_type, reference_id, description, debit, credit, balance, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.businessId,
      input.entryDate,
      input.partyType ?? null,
      input.partyId ?? null,
      input.referenceType,
      input.referenceId ?? null,
      input.description,
      input.debit,
      input.credit,
      balance,
      nowISO(),
    ],
  )

  return {
    id,
    businessId: input.businessId,
    entryDate: input.entryDate,
    partyType: input.partyType ?? null,
    partyId: input.partyId ?? null,
    referenceType: input.referenceType,
    referenceId: input.referenceId ?? null,
    description: input.description,
    debit: input.debit,
    credit: input.credit,
    balance,
    createdAt: nowISO(),
  }
}

/**
 * Query ledger entries with filters.
 */
export async function getLedgerEntries(
  filter: LedgerFilter & { businessId: string; page?: number; pageSize?: number },
): Promise<{ data: LedgerEntry[]; total: number; summary: LedgerSummary }> {
  const conditions: string[] = ['le.business_id = ?']
  const params: unknown[] = [filter.businessId]

  if (filter.partyType) { conditions.push('le.party_type = ?'); params.push(filter.partyType) }
  if (filter.partyId) { conditions.push('le.party_id = ?'); params.push(filter.partyId) }
  if (filter.fromDate) { conditions.push('le.entry_date >= ?'); params.push(filter.fromDate) }
  if (filter.toDate) { conditions.push('le.entry_date <= ?'); params.push(filter.toDate) }

  const whereClause = conditions.join(' AND ')
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const [rows, countResult, summaryResult] = await Promise.all([
    dbSelect<Record<string, unknown>>(
      `SELECT le.* FROM ledger_entries le WHERE ${whereClause} ORDER BY le.entry_date ASC, le.created_at ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ),
    dbSelect<{ total: number }>(
      `SELECT COUNT(*) as total FROM ledger_entries le WHERE ${whereClause}`,
      params,
    ),
    dbSelect<{ total_debit: number; total_credit: number }>(
      `SELECT COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit FROM ledger_entries le WHERE ${whereClause}`,
      params,
    ),
  ])

  const totalDebit = summaryResult[0]?.total_debit ?? 0
  const totalCredit = summaryResult[0]?.total_credit ?? 0

  // Opening balance: last balance before the fromDate filter
  let openingBalance = 0
  if (filter.partyId && filter.fromDate) {
    const openingRows = await dbSelect<{ balance: number }>(
      `SELECT balance FROM ledger_entries
       WHERE business_id = ? AND party_type = ? AND party_id = ? AND entry_date < ?
       ORDER BY entry_date DESC, created_at DESC
       LIMIT 1`,
      [filter.businessId, filter.partyType, filter.partyId, filter.fromDate],
    )
    openingBalance = openingRows[0]?.balance ?? 0
  }

  return {
    data: rows as unknown as LedgerEntry[],
    total: countResult[0]?.total ?? 0,
    summary: {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: openingBalance + totalDebit - totalCredit,
    },
  }
}

/**
 * Get outstanding balance for a party (customer or supplier).
 */
export async function getPartyBalance(
  businessId: string,
  partyType: LedgerPartyType,
  partyId: string,
): Promise<number> {
  const rows = await dbSelect<{ balance: number }>(
    `SELECT balance FROM ledger_entries
     WHERE business_id = ? AND party_type = ? AND party_id = ?
     ORDER BY entry_date DESC, created_at DESC
     LIMIT 1`,
    [businessId, partyType, partyId],
  )
  return rows[0]?.balance ?? 0
}

/**
 * Recalculate running balances for all ledger entries of a specific party.
 * Ensures that if any past entries are deleted or restored, every entry's
 * running balance is 100% mathematically consistent.
 */
export async function recalculatePartyLedgerBalances(
  businessId: string,
  partyType: LedgerPartyType,
  partyId: string,
  tx?: { select: typeof dbSelect; execute: typeof dbExecute },
): Promise<void> {
  const executor = tx ?? { select: dbSelect, execute: dbExecute }
  const entries = await executor.select<{ id: string; debit: number; credit: number }>(
    `SELECT id, debit, credit FROM ledger_entries
     WHERE business_id = ? AND party_type = ? AND party_id = ?
     ORDER BY entry_date ASC, created_at ASC`,
    [businessId, partyType, partyId],
  )
  let currentBalance = 0
  for (const entry of entries) {
    currentBalance = currentBalance + (entry.debit || 0) - (entry.credit || 0)
    await executor.execute(
      `UPDATE ledger_entries SET balance = ? WHERE id = ?`,
      [currentBalance, entry.id],
    )
  }
}

/**
 * Remove all ledger entries referencing a specific entity (e.g. deleted invoice)
 * and recalculate the affected party's running balances.
 */
export async function removeLedgerEntriesForReference(
  businessId: string,
  referenceType: LedgerReferenceType,
  referenceId: string,
  tx?: { select: typeof dbSelect; execute: typeof dbExecute },
): Promise<void> {
  const executor = tx ?? { select: dbSelect, execute: dbExecute }
  const affectedParties = await executor.select<{ party_type: LedgerPartyType; party_id: string }>(
    `SELECT DISTINCT party_type, party_id FROM ledger_entries
     WHERE business_id = ? AND reference_type = ? AND reference_id = ? AND party_type IS NOT NULL AND party_id IS NOT NULL`,
    [businessId, referenceType, referenceId],
  )

  await executor.execute(
    `DELETE FROM ledger_entries WHERE business_id = ? AND reference_type = ? AND reference_id = ?`,
    [businessId, referenceType, referenceId],
  )

  for (const p of affectedParties) {
    await recalculatePartyLedgerBalances(businessId, p.party_type, p.party_id, tx)
  }
}
