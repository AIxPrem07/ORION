import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Printer, Download, Trash2, Calendar, FileText, Search } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { Badge } from '@components/ui/Badge'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { useUIStore } from '@store/ui.store'
import { useFiscalYearStore } from '@store/fiscal-year.store'
import { listChallans, deleteChallan, getChallanWithItems } from '@services/challan.service'
import { downloadChallanPDF, printChallanPDF } from '@services/pdf.service'
import { formatCurrency } from '@utils/decimal'
import { formatDate, formatFinancialYearLabel } from '@utils/date'
import type { Challan } from '@/types/challan'

const PAGE_SIZE = 50

export default function ChallanList() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()
  const { openConfirm } = useUIStore()
  const { selectedFY } = useFiscalYearStore()

  const [challans, setChallans] = useState<Challan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const res = await listChallans({
        businessId: business.id,
        financialYear: selectedFY === 'ALL' ? undefined : selectedFY,
        search: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setChallans(res.data)
      setTotal(res.total)
    } catch (err: any) {
      error('Failed to load delivery challans')
    } finally {
      setIsLoading(false)
    }
  }, [business, selectedFY, search, page, error])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = (challan: Challan) => {
    openConfirm({
      title: 'Delete Delivery Challan',
      message: `Are you sure you want to delete Challan #${challan.challanNumber}? Dispatched stock quantities will be returned to inventory and customer ledger balance will be updated.`,
      confirmLabel: 'Delete Challan',
      variant: 'danger',
      onConfirm: async () => {
        if (!business) return
        try {
          await deleteChallan(challan.id, business.id)
          success(`Challan #${challan.challanNumber} deleted and stock restored.`)
          loadData()
        } catch (err: any) {
          error(err.message || 'Failed to delete challan')
        }
      },
    })
  }

  const handlePrint = async (challan: Challan) => {
    if (!business) return
    try {
      const full = await getChallanWithItems(challan.id)
      if (!full) return
      await printChallanPDF(full, business)
    } catch (err: any) {
      error('Failed to print challan')
    }
  }

  const handleDownload = async (challan: Challan) => {
    if (!business) return
    try {
      const full = await getChallanWithItems(challan.id)
      if (!full) return
      await downloadChallanPDF(full, business)
      success('Challan PDF downloaded')
    } catch (err: any) {
      error('Failed to download challan')
    }
  }

  const columns = [
    {
      key: 'challan_number',
      header: 'Challan #',
      cell: (c: Challan) => (
        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
          <FileText size={14} className="text-indigo-600 shrink-0" />
          <span>{c.challanNumber}</span>
        </div>
      ),
    },
    {
      key: 'challan_date',
      header: 'Date',
      cell: (c: Challan) => (
        <span className="text-gray-700 text-xs whitespace-nowrap">{formatDate(c.challanDate)}</span>
      ),
    },
    {
      key: 'fy',
      header: 'FY',
      cell: (c: Challan) => (
        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
          {c.financialYear || '—'}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (c: Challan) => (
        <div>
          <div className="font-medium text-gray-900">{c.customerSnapshot?.name || 'Walk-in Customer'}</div>
          {c.customerSnapshot?.phone && (
            <div className="text-[11px] text-gray-500">{c.customerSnapshot.phone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'transport',
      header: 'Transport / Vehicle',
      cell: (c: Challan) => (
        <div className="text-xs text-gray-600">
          {c.vehicleNumber ? (
            <div className="font-medium text-gray-800">{c.vehicleNumber}</div>
          ) : null}
          <div>{c.transporterName || c.transportMode || '—'}</div>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total Value',
      cell: (c: Challan) => (
        <div className="font-bold text-gray-900 tabular-nums">
          {formatCurrency(c.totalAmount)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c: Challan) => (
        <Badge variant={c.status === 'DELIVERED' ? 'success' : 'default'}>
          {c.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (c: Challan) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePrint(c)}
            title="Print Delivery Challan"
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            <Printer size={14} />
          </button>
          <button
            onClick={() => handleDownload(c)}
            title="Download PDF"
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => handleDelete(c)}
            title="Delete Challan"
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Delivery Challans"
        subtitle={`Goods dispatch documents linked to stock & customer ledger without GST (${formatFinancialYearLabel(selectedFY)})`}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => navigate('/challans/new')}
          >
            New Delivery Challan
          </Button>
        }
      />

      {/* Filter / Search Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="w-80">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val)
              setPage(1)
            }}
            placeholder="Search by challan number, customer..."
          />
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>Active FY Filter:</span>
          <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            {formatFinancialYearLabel(selectedFY)}
          </span>
        </div>
      </div>

      {isLoading ? (
        <LoadingState fullHeight />
      ) : challans.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
          <Table data={challans} columns={columns} keyExtractor={(c) => c.id} />
          <Pagination
            page={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <EmptyState
          icon={<FileText size={32} />}
          title="No Delivery Challans Found"
          description={
            search
              ? 'No challans matched your search.'
              : `No delivery challans recorded for ${formatFinancialYearLabel(selectedFY)}.`
          }
          action={{
            label: '+ New Delivery Challan',
            onClick: () => navigate('/challans/new'),
          }}
        />
      )}
    </div>
  )
}
