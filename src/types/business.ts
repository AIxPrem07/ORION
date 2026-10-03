import type { UUID, ISODateTimeString } from './common'

export interface Business {
  id: UUID
  name: string
  logoPath: string | null
  address: string | null
  city: string | null
  state: string | null
  stateCode: string | null
  pin: string | null
  phone: string | null
  email: string | null
  website: string | null
  gstin: string | null
  pan: string | null
  bankName: string | null
  accountNumber: string | null
  ifsc: string | null
  upiId: string | null
  invoicePrefix: string
  financialYearStart: number  // month number (4 = April)
  signaturePath: string | null
  termsAndConditions: string | null
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}

export type BusinessFormData = Omit<Business, 'id' | 'createdAt' | 'updatedAt'>

export interface AppSettings {
  id: UUID
  key: string
  value: string | null
  description: string | null
  updatedAt: ISODateTimeString
}

export type InvoicePaperSize = 'A4' | 'A5' | 'THERMAL'
export type InvoiceTheme = 'SLATE_BLUE' | 'CLASSIC_NAVY' | 'MONOCHROME' | 'EMERALD'

export type AppSettingKey =
  | 'device_id'
  | 'app_version'
  | 'db_version'
  | 'last_backup_at'
  | 'gst_mode'           // 'inclusive' | 'exclusive'
  | 'default_payment_terms'
  | 'low_stock_threshold'
  | 'setup_complete'
  | 'theme'
  | 'invoice_paper_size'
  | 'invoice_theme'
  | 'invoice_design_config'
  | 'license_status'
  | 'license_key'
  | 'license_client_name'
  | 'license_plan'
  | 'license_edition'
  | 'license_activated_at'
  | 'license_device_id'
