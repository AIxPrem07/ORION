import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string | ReactNode
  cell: (row: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  isLoading?: boolean
  emptyState?: ReactNode
  stickyHeader?: boolean
}

export function Table<T>({
  columns, data, keyExtractor, onRowClick, isLoading, emptyState, stickyHeader,
}: TableProps<T>) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <tr className="bg-gray-50 border-b border-orion-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase tracking-wide ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-orion-border last:border-0 hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-2.5 text-gray-800 ${col.className ?? ''}`}>
                  {col.cell(row, idx)}
                </td>
              ))}
            </tr>
          ))}
          {!isLoading && data.length === 0 && emptyState && (
            <tr>
              <td colSpan={columns.length} className="py-0">
                {emptyState}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
