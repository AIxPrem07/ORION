import { useEffect, useState, useCallback } from 'react'
import { Download } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import LoadingState from '@components/ui/LoadingState'
import { Select } from '@components/ui/Select'
import { StatCard } from '@components/ui/Card'
import { useBusinessStore } from '@store/business.store'
import { listSuppliers } from '@services/supplier.service'
import { getLedgerEntries } from '@services/ledger.service'
import { exportLedgerToCSV, triggerCSVDownload } from '@services/import-export.service'
import { formatCurrency } from '@utils/decimal'
import { formatDate } from '@utils/date'
import type { Supplier } from '@/types/supplier'
import type { LedgerEntry, LedgerSummary } from '@/types/ledger'

export default function SupplierLedger() {
  const { business } = useBusinessStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<LedgerSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!business) return
    listSuppliers({ businessId: business.id, isActive: true, pageSize: 500 }).then((r) => setSuppliers(r.data))
  }, [business])

  const load = useCallback(async () => {
    if (!business || !selectedId) return
    setIsLoading(true)
    try {
      const result = await getLedgerEntries({ businessId: business.id, partyType: 'SUPPLIER', partyId: selectedId })
      setEntries(result.data)
      setSummary(result.summary)
    } finally {
      setIsLoading(false)
    }
  }, [business, selectedId])

  useEffect(() => { load() }, [load])

  const selectedSupplier = suppliers.find((s) => s.id === selectedId)

  const handleExportCSV = async () => {
    if (!business || !selectedId) return
    setIsExporting(true)
    try {
      const partyName = selectedSupplier?.name || 'Supplier'
      const csv = await exportLedgerToCSV(business.id, {
        partyType: 'SUPPLIER',
        partyId: selectedId,
        partyName,
      })
      const sanitizedName = partyName.replace(/[^a-zA-Z0-9_-]/g, '_')
      triggerCSVDownload(`Supplier_Ledger_${sanitizedName}.csv`, csv)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Supplier Ledger"
        actions={
          selectedId ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download size={13} />}
              onClick={handleExportCSV}
              isLoading={isExporting}
            >
              Export CSV
            </Button>
          ) : undefined
        }
      />
      <div className="max-w-xs">
        <Select options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select supplier..." value={selectedId} onChange={(e) => setSelectedId(e.target.value)} />
      </div>
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Opening" value={formatCurrency(summary.openingBalance)} />
          <StatCard label="Total Debit" value={formatCurrency(summary.totalDebit)} />
          <StatCard label="Total Credit" value={formatCurrency(summary.totalCredit)} />
          <StatCard label="Closing" value={formatCurrency(summary.closingBalance)} />
        </div>
      )}
      {isLoading ? <LoadingState fullHeight /> : entries.length > 0 ? (
        <div className="bg-white border border-orion-border rounded-lg shadow-orion overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-orion-border">
              <tr>{['Date', 'Description', 'Debit', 'Credit', 'Balance'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-orion-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs">{formatDate(e.entryDate)}</td>
                  <td className="px-4 py-2.5">{e.description}</td>
                  <td className="px-4 py-2.5 tabular-nums text-red-600">{e.debit > 0 ? formatCurrency(e.debit) : '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums text-green-600">{e.credit > 0 ? formatCurrency(e.credit) : '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">{formatCurrency(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
