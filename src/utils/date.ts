/**
 * ORION Date Utilities
 * 
 * All dates stored as ISO 8601 strings in SQLite.
 * Financial year in India: April 1 to March 31.
 */
import { format, parseISO, isValid, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths, startOfYear, endOfYear } from 'date-fns'

/** Format ISO date string to display format */
export function formatDate(isoDate: string | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!isoDate) return '—'
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate
  if (!isValid(date)) return '—'
  return format(date, fmt)
}

/** Format ISO date string to short format: 29 Sep 2026 */
export function formatDateShort(isoDate: string | null | undefined): string {
  return formatDate(isoDate, 'dd MMM yyyy')
}

/** Format ISO date string to long format with time */
export function formatDateTime(isoDate: string | null | undefined): string {
  return formatDate(isoDate, 'dd MMM yyyy, hh:mm a')
}

/** Get today as ISO date string (YYYY-MM-DD) */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Get current ISO datetime string */
export function nowISO(): string {
  return new Date().toISOString()
}

/** Get current Indian financial year string, e.g. "26-27" */
export function currentFinancialYear(): string {
  return getFinancialYearFromDate(new Date())
}

/** Get Indian financial year string for any given date or ISO string, e.g. "26-27" */
export function getFinancialYearFromDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return currentFinancialYear()
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  if (!isValid(d)) return currentFinancialYear()
  const month = d.getMonth() + 1 // 1-12
  const year = d.getFullYear()
  if (month >= 4) {
    const startYear = year % 100
    const endYear = (year + 1) % 100
    return `${String(startYear).padStart(2, '0')}-${String(endYear).padStart(2, '0')}`
  } else {
    const startYear = (year - 1) % 100
    const endYear = year % 100
    return `${String(startYear).padStart(2, '0')}-${String(endYear).padStart(2, '0')}`
  }
}

/** Format FY code like "26-27" to human label "FY 2026-27" */
export function formatFinancialYearLabel(fyString: string): string {
  if (!fyString || fyString === 'ALL') return 'All Financial Years'
  const parts = fyString.split('-')
  if (parts.length === 2) {
    const startYear = 2000 + parseInt(parts[0], 10)
    return `FY ${startYear}-${parts[1]}`
  }
  return `FY ${fyString}`
}

/** Get list of selectable financial years */
export function getRecentFinancialYears(): string[] {
  const current = currentFinancialYear()
  const [currStart] = current.split('-').map(Number)
  const fys: string[] = []
  // Generate next FY, current FY, and past 3 FYs
  for (let i = currStart + 1; i >= currStart - 3; i--) {
    const s = String(i).padStart(2, '0')
    const e = String((i + 1) % 100).padStart(2, '0')
    fys.push(`${s}-${e}`)
  }
  return fys
}

/** Get financial year start date (April 1) as ISO string */
export function financialYearStart(fyString?: string): string {
  if (fyString) {
    const [startYY] = fyString.split('-')
    const startYear = 2000 + parseInt(startYY, 10)
    return `${startYear}-04-01`
  }
  const fy = currentFinancialYear()
  return financialYearStart(fy)
}

/** Get financial year end date (March 31) as ISO string */
export function financialYearEnd(fyString?: string): string {
  if (fyString) {
    const [, endYY] = fyString.split('-')
    const endYear = 2000 + parseInt(endYY, 10)
    return `${endYear}-03-31`
  }
  const fy = currentFinancialYear()
  return financialYearEnd(fy)
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_fy'
  | 'custom'

export interface DateRange {
  from: string
  to: string
  label: string
}

/** Get date range for a preset */
export function getDateRange(preset: DateRangePreset, custom?: { from: string; to: string }): DateRange {
  const now = new Date()
  switch (preset) {
    case 'today':
      return {
        from: format(startOfDay(now), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
        label: 'Today',
      }
    case 'yesterday': {
      const yesterday = subDays(now, 1)
      return {
        from: format(startOfDay(yesterday), 'yyyy-MM-dd'),
        to: format(endOfDay(yesterday), 'yyyy-MM-dd'),
        label: 'Yesterday',
      }
    }
    case 'this_week': {
      const weekStart = subDays(now, now.getDay() === 0 ? 6 : now.getDay() - 1)
      return {
        from: format(startOfDay(weekStart), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
        label: 'This Week',
      }
    }
    case 'this_month':
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to: format(endOfMonth(now), 'yyyy-MM-dd'),
        label: 'This Month',
      }
    case 'last_month': {
      const lastMonth = subMonths(now, 1)
      return {
        from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        to: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        label: 'Last Month',
      }
    }
    case 'this_fy':
      return {
        from: financialYearStart(),
        to: financialYearEnd(),
        label: `FY ${currentFinancialYear()}`,
      }
    case 'custom':
      return {
        from: custom?.from ?? format(startOfYear(now), 'yyyy-MM-dd'),
        to: custom?.to ?? format(endOfYear(now), 'yyyy-MM-dd'),
        label: 'Custom Range',
      }
    default:
      return getDateRange('today')
  }
}
