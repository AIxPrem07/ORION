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
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()
  if (month >= 4) {
    // April or later: FY starts this year
    const startYear = year % 100
    const endYear = (year + 1) % 100
    return `${String(startYear).padStart(2, '0')}-${String(endYear).padStart(2, '0')}`
  } else {
    // Jan-March: FY started last year
    const startYear = (year - 1) % 100
    const endYear = year % 100
    return `${String(startYear).padStart(2, '0')}-${String(endYear).padStart(2, '0')}`
  }
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
