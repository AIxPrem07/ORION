/** Shared primitive types used across ORION */

/** ISO 8601 date string: "2026-04-01" */
export type ISODateString = string

/** ISO 8601 datetime string: "2026-04-01T00:00:00.000Z" */
export type ISODateTimeString = string

/** UUID v4 string */
export type UUID = string

/** Monetary amount in paise (integer). ₹1 = 100 paise */
export type Paise = number

/** Quantity stored as integer × 100 (2 decimal places). 150 = 1.50 */
export type QuantityInt = number

/** Rate in basis points. 100 = 1%, 1800 = 18% */
export type BasisPoints = number

/** GST 2-digit state code, e.g. "27" for Maharashtra */
export type StateCode = string

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DateRangeFilter {
  from: ISODateString
  to: ISODateString
}

export type SortDirection = 'asc' | 'desc'

export interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}
