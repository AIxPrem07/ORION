/**
 * ORION Error Handling Utilities
 * 
 * Converts technical errors into user-friendly messages.
 * NEVER expose raw SQLite/Rust errors to the user.
 */

export interface OrionError {
  code: string
  message: string      // user-facing
  detail?: string      // developer detail (logged, not displayed)
  field?: string       // form field that caused the error
}

/** Known error patterns and their user-friendly messages */
const ERROR_PATTERNS: Array<{ pattern: RegExp | string; code: string; message: string }> = [
  {
    pattern: /SQLITE_CONSTRAINT_UNIQUE|UNIQUE constraint failed/i,
    code: 'DUPLICATE_ENTRY',
    message: 'A record with this information already exists.',
  },
  {
    pattern: /UNIQUE constraint failed.*invoice_number|invoice_number.*UNIQUE/i,
    code: 'DUPLICATE_INVOICE_NUMBER',
    message: 'This invoice number already exists. Please use a different number.',
  },
  {
    pattern: /SQLITE_CONSTRAINT_FOREIGNKEY|FOREIGN KEY constraint failed/i,
    code: 'FOREIGN_KEY_VIOLATION',
    message: 'This record cannot be deleted because other records are linked to it.',
  },
  {
    pattern: /SQLITE_CONSTRAINT_NOTNULL|NOT NULL constraint failed/i,
    code: 'REQUIRED_FIELD',
    message: 'A required field is missing.',
  },
  {
    pattern: /database.*locked|SQLITE_BUSY/i,
    code: 'DB_BUSY',
    message: 'The database is busy. Please try again in a moment.',
  },
  {
    pattern: /SQLITE_CORRUPT/i,
    code: 'DB_CORRUPT',
    message: 'Database integrity issue detected. Please restore from backup.',
  },
  {
    pattern: /network|fetch|connection refused/i,
    code: 'NETWORK_ERROR',
    message: 'Network error. Please check your connection and try again.',
  },
  {
    pattern: /permission denied|access denied/i,
    code: 'PERMISSION_DENIED',
    message: 'Permission denied. Please check file/folder permissions.',
  },
]

/** Normalize any thrown value into an OrionError */
export function normalizeError(err: unknown): OrionError {
  const raw = err instanceof Error ? err.message : String(err)
  const lowerRaw = raw.toLowerCase()

  for (const { pattern, code, message } of ERROR_PATTERNS) {
    const matched =
      pattern instanceof RegExp ? pattern.test(raw) : lowerRaw.includes(pattern.toLowerCase())
    if (matched) {
      console.error(`[ORION Error] [${code}]`, raw)
      return { code, message, detail: raw }
    }
  }

  // Generic fallback
  console.error('[ORION Error] [UNKNOWN]', raw)
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    detail: raw,
  }
}

/** Get user-facing message from any error */
export function getUserMessage(err: unknown): string {
  return normalizeError(err).message
}

/** Log structured error without exposing to user */
export function logError(context: string, err: unknown): void {
  const normalized = normalizeError(err)
  console.error(`[ORION] [${context}]`, {
    code: normalized.code,
    detail: normalized.detail,
    timestamp: new Date().toISOString(),
  })
}
