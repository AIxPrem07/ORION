import type { Paise } from './common'

export interface GSTR1B2BInvoice {
  receiverGstin: string
  receiverName: string
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  invoiceValue: Paise
  pos: string // e.g. "27-Maharashtra"
  reverseCharge: 'Y' | 'N'
  rate: number // percentage e.g. 18
  taxableValue: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  cessAmount: Paise
}

export interface GSTR1B2CLInvoice {
  invoiceNumber: string
  invoiceDate: string
  invoiceValue: Paise
  pos: string
  rate: number
  taxableValue: Paise
  igstAmount: Paise
  cessAmount: Paise
}

export interface GSTR1B2CSSupply {
  supplyType: 'INTRA' | 'INTER'
  pos: string
  rate: number
  taxableValue: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  cessAmount: Paise
}

export interface GSTR1CDNRNote {
  receiverGstin: string
  receiverName: string
  noteNumber: string
  noteDate: string
  noteType: 'C' | 'D' // Credit or Debit
  pos: string
  reverseCharge: 'Y' | 'N'
  noteValue: Paise
  rate: number
  taxableValue: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  cessAmount: Paise
}

export interface GSTR1HSNSummary {
  hsnCode: string
  description: string
  uqc: string // e.g. "NOS-NUMBERS", "KGS-KILOGRAMS"
  totalQuantity: number // unscaled (e.g. 5.5 units)
  totalValue: Paise
  taxableValue: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  igstAmount: Paise
  cessAmount: Paise
}

export interface GSTR1DocSummary {
  docType: string
  fromSerial: string
  toSerial: string
  totalCount: number
  cancelledCount: number
  netCount: number
}

export interface GSTR1Data {
  b2b: GSTR1B2BInvoice[]
  b2cl: GSTR1B2CLInvoice[]
  b2cs: GSTR1B2CSSupply[]
  cdnr: GSTR1CDNRNote[]
  hsn: GSTR1HSNSummary[]
  docs: GSTR1DocSummary[]
  totalTaxableValue: Paise
  totalIgst: Paise
  totalCgst: Paise
  totalSgst: Paise
  totalTax: Paise
  totalGrossValue: Paise
  invoiceCount: number
}

export interface GSTR3BTable31 {
  code: string
  description: string
  taxableValue: Paise
  igstAmount: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  cessAmount: Paise
}

export interface GSTR3BTable32 {
  posCode: string
  posName: string
  taxableValue: Paise
  igstAmount: Paise
}

export interface GSTR3BTable4ITC {
  code: string
  description: string
  taxableValue: Paise
  igstAmount: Paise
  cgstAmount: Paise
  sgstAmount: Paise
  cessAmount: Paise
}

export interface GSTR3BTaxPayable {
  taxHead: 'IGST' | 'CGST' | 'SGST' | 'CESS'
  outwardLiability: Paise
  itcOffset: Paise
  netTaxPayable: Paise
}

export interface GSTR3BData {
  table31: GSTR3BTable31[]
  table32: GSTR3BTable32[]
  table4: GSTR3BTable4ITC[]
  taxPayable: GSTR3BTaxPayable[]
  totalOutwardTaxable: Paise
  totalOutwardTax: Paise
  totalEligibleITC: Paise
  netCashPayable: Paise
}

export interface GSTReturnPeriod {
  financialYear: string // e.g. "2026-27"
  periodType: 'MONTHLY' | 'QUARTERLY' | 'CUSTOM'
  month: number // 1 to 12
  quarter: number // 1 to 4
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  periodCode: string // e.g. "052026" (MMYYYY)
  label: string
}
