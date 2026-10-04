import type { UUID, ISODateString, ISODateTimeString, Paise } from './common'

export type LedgerReferenceType = 'INVOICE' | 'PURCHASE' | 'PAYMENT' | 'ADJUSTMENT' | 'OPENING' | 'RETURN' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'CHALLAN'
export type LedgerPartyType = 'CUSTOMER' | 'SUPPLIER'

export interface LedgerEntry {
  id: UUID
  businessId: UUID
  entryDate: ISODateString
  partyType: LedgerPartyType | null
  partyId: UUID | null
  referenceType: LedgerReferenceType
  referenceId: UUID | null
  description: string
  debit: Paise
  credit: Paise
  balance: Paise
  createdAt: ISODateTimeString
}

export interface LedgerFilter {
  partyType?: LedgerPartyType
  partyId?: UUID
  fromDate?: ISODateString
  toDate?: ISODateString
}

export interface LedgerSummary {
  openingBalance: Paise
  totalDebit: Paise
  totalCredit: Paise
  closingBalance: Paise
}
