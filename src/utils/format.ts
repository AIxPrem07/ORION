/**
 * ORION Formatting Utilities
 * 
 * Display formatting for numbers, percentages, phone numbers, GSTIN, etc.
 */

/** Format a number with Indian number system separators */
export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

/** Format a percentage from basis points */
export function formatPercent(basisPoints: number, decimals = 2): string {
  return `${(basisPoints / 100).toFixed(decimals)}%`
}

/** Mask a sensitive number like account number */
export function maskSensitive(value: string, showLast = 4): string {
  if (value.length <= showLast) return value
  return '*'.repeat(value.length - showLast) + value.slice(-showLast)
}

/** Format GSTIN for display: 27AABCU9603R1ZX → valid format check */
export function formatGSTIN(gstin: string): string {
  return gstin.toUpperCase().trim()
}

/** Format phone number for display */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone
}

/** Truncate string to max length with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/** Convert snake_case or UPPER_CASE to Title Case */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Pad invoice sequence number */
export function padSequence(n: number, padding: number): string {
  return String(n).padStart(padding, '0')
}

/** Build invoice display number from parts */
export function buildInvoiceNumber(prefix: string, fy: string, sequence: number, padding = 4): string {
  return `${prefix}/${fy}/${padSequence(sequence, padding)}`
}

/** Format file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
