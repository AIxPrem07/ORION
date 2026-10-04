import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Download, Trash2, RotateCcw, Edit2, AlertTriangle, Archive, RefreshCw } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { SearchInput } from '@components/ui/SearchInput'
import { Table } from '@components/ui/Table'
import { Pagination } from '@components/ui/Pagination'
import { InvoiceStatusBadge, PaymentStatusBadge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import LoadingState from '@components/ui/LoadingState'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { useUIStore } from '@store/ui.store'
import { useFiscalYearStore } from '@store/fiscal-year.store'
import {
  listInvoices,
  moveInvoiceToBin,
  restoreInvoiceFromBin,
  permanentlyDeleteInvoice,
  emptyInvoiceBin,
  getBinInvoicesCount,
  updateInvoiceNumber,
} from '@services/invoice.service'
import { formatCurrency } from '@utils/decimal'
import { formatDate, formatFinancialYearLabel } from '@utils/date'
import { exportInvoicesToCSV, triggerCSVDownload } from '@services/import-export.service'
import type { Invoice } from '@/types/invoice'

const PAGE_SIZE = 50

export default function InvoiceList() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()
  const { openConfirm } = useUIStore()
  const { selectedFY } = useFiscalYearStore()

  const [activeTab, setActiveTab] = useState<'active' | 'bin'>('active')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [binCount, setBinCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  // Edit Invoice Number Modal State
  const [editNumberInvoice, setEditNumberInvoice] = useState<Invoice | null>(null)
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('')
  const [isUpdatingNumber, setIsUpdatingNumber] = useState(false)
  const [updateNumberError, setUpdateNumberError] = useState('')

  const loadBinCount = useCallback(async () => {
    if (!business) return
    try {
      const count = await getBinInvoicesCount(business.id)
      setBinCount(count)
    } catch {
      // ignore
    }
  }, [business])

  const load = useCallback(async () => {
    if (!business) return
    setIsLoading(true)
    try {
      const result = await listInvoices({
        businessId: business.id,
        search,
        page,
        pageSize: PAGE_SIZE,
        inBin: activeTab === 'bin',
        financialYear: selectedFY === 'ALL' ? undefined : selectedFY,
      })
      setInvoices(result.data)
      setTotal(result.total)
      await loadBinCount()
    } catch (err) {
      error('Failed to load invoices', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [business, search, page, activeTab, selectedFY, loadBinCount, error])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search, activeTab])

  const handleExport = async () => {
    if (!business) return
    setIsExporting(true)
    try {
      const csv = await exportInvoicesToCSV(business.id)
      triggerCSVDownload('invoices.csv', csv)
    } catch (err) {
      error('Export failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleMoveToBin = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!business) return
    openConfirm({
      title: 'Move Invoice to Bin',
      message: `Move ${inv.invoiceNumber} to the Recycle Bin? If this invoice was finalized, stock and customer ledger balance will be safely reversed while in the bin.`,
      variant: 'warning',
      confirmLabel: 'Move to Bin',
      onConfirm: async () => {
        try {
          await moveInvoiceToBin(inv.id, business.id)
          success('Moved to Bin', `Invoice ${inv.invoiceNumber} moved to Recycle Bin.`)
          await load()
        } catch (err) {
          error('Failed to move to bin', err instanceof Error ? err.message : 'Unknown error')
        }
      },
    })
  }

  const handleRestore = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!business) return
    openConfirm({
      title: 'Restore Invoice',
      message: `Restore ${inv.invoiceNumber} back to active invoices? Stock deductions and customer balances will be reinstated.`,
      variant: 'default',
      confirmLabel: 'Restore Invoice',
      onConfirm: async () => {
        try {
          await restoreInvoiceFromBin(inv.id, business.id)
          success('Restored', `Invoice ${inv.invoiceNumber} has been restored to active invoices.`)
          await load()
        } catch (err) {
          error('Failed to restore invoice', err instanceof Error ? err.message : 'Unknown error')
        }
      },
    })
  }

  const handleDeletePermanent = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!business) return
    openConfirm({
      title: 'Permanently Delete Invoice',
      message: `Are you absolutely sure you want to permanently delete invoice ${inv.invoiceNumber}? This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Permanently',
      onConfirm: async () => {
        try {
          await permanentlyDeleteInvoice(inv.id, business.id)
          success('Permanently Deleted', `Invoice ${inv.invoiceNumber} has been completely removed.`)
          await load()
        } catch (err) {
          error('Failed to delete', err instanceof Error ? err.message : 'Unknown error')
        }
      },
    })
  }

  const handleEmptyBin = () => {
    if (!business || binCount === 0) return
    openConfirm({
      title: 'Empty Recycle Bin',
      message: `Are you sure you want to permanently delete all ${binCount} invoices in the Recycle Bin? This action is permanent and cannot be reversed.`,
      variant: 'danger',
      confirmLabel: 'Empty All Invoices',
      onConfirm: async () => {
        try {
          const purged = await emptyInvoiceBin(business.id)
          success('Recycle Bin Emptied', `Permanently removed ${purged} invoices.`)
          await load()
        } catch (err) {
          error('Failed to empty bin', err instanceof Error ? err.message : 'Unknown error')
        }
      },
    })
  }

  const openEditNumberModal = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditNumberInvoice(inv)
    setNewInvoiceNumber(inv.invoiceNumber)
    setUpdateNumberError('')
  }

  const handleSaveInvoiceNumber = async () => {
    if (!business || !editNumberInvoice) return
    const trimmed = newInvoiceNumber.trim()
    if (!trimmed) {
      setUpdateNumberError('Invoice number cannot be empty.')
      return
    }
    if (trimmed === editNumberInvoice.invoiceNumber) {
      setEditNumberInvoice(null)
      return
    }

    setIsUpdatingNumber(true)
    setUpdateNumberError('')
    try {
      await updateInvoiceNumber(editNumberInvoice.id, business.id, trimmed)
      success('Invoice Number Updated', `Changed from ${editNumberInvoice.invoiceNumber} to ${trimmed}`)
      setEditNumberInvoice(null)
      await load()
    } catch (err) {
      setUpdateNumberError(err instanceof Error ? err.message : 'Failed to update invoice number.')
    } finally {
      setIsUpdatingNumber(false)
    }
  }

  const activeColumns = [
    {
      key: 'number',
      header: 'Invoice #',
      cell: (inv: Invoice) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{inv.invoiceNumber}</span>
          <button
            type="button"
            onClick={(e) => openEditNumberModal(inv, e)}
            className="p-1 text-gray-400 hover:text-orion-primary rounded hover:bg-gray-100 transition-colors"
            title="Change Invoice Number"
          >
            <Edit2 size={13} />
          </button>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', cell: (inv: Invoice) => inv.customerSnapshot?.name ?? 'Walk-in' },
    { key: 'date', header: 'Date', cell: (inv: Invoice) => formatDate(inv.invoiceDate) },
    {
      key: 'amount',
      header: 'Amount',
      cell: (inv: Invoice) => <span className="tabular-nums font-medium">{formatCurrency(inv.totalAmount)}</span>,
      className: 'text-right',
      headerClassName: 'text-right',
    },
    { key: 'status', header: 'Status', cell: (inv: Invoice) => <InvoiceStatusBadge status={inv.status} /> },
    { key: 'payment', header: 'Payment', cell: (inv: Invoice) => <PaymentStatusBadge status={inv.paymentStatus} /> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (inv: Invoice) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => openEditNumberModal(inv, e)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
            title="Change Invoice Number"
          >
            <Edit2 size={12} />
            <span>Edit #</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleMoveToBin(inv, e)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
            title="Move to Recycle Bin"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
      className: 'text-right',
      headerClassName: 'text-right',
    },
  ]

  const binColumns = [
    {
      key: 'number',
      header: 'Invoice #',
      cell: (inv: Invoice) => <span className="font-semibold text-gray-900 line-through decoration-gray-400">{inv.invoiceNumber}</span>,
    },
    { key: 'customer', header: 'Customer', cell: (inv: Invoice) => inv.customerSnapshot?.name ?? 'Walk-in' },
    { key: 'date', header: 'Invoice Date', cell: (inv: Invoice) => formatDate(inv.invoiceDate) },
    {
      key: 'deletedAt',
      header: 'Deleted At',
      cell: (inv: Invoice) => (
        <span className="text-xs text-red-600 font-medium">
          {inv.deletedAt ? formatDate(inv.deletedAt) : 'Recently'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (inv: Invoice) => <span className="tabular-nums font-medium text-gray-600">{formatCurrency(inv.totalAmount)}</span>,
      className: 'text-right',
      headerClassName: 'text-right',
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (inv: Invoice) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => handleRestore(inv, e)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
            title="Restore invoice back to active"
          >
            <RotateCcw size={12} />
            <span>Restore</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleDeletePermanent(inv, e)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
            title="Permanently Delete"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      ),
      className: 'text-right',
      headerClassName: 'text-right',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Invoices"
        subtitle={
          activeTab === 'active'
            ? `${total} active invoice${total !== 1 ? 's' : ''}${selectedFY !== 'ALL' ? ` (${formatFinancialYearLabel(selectedFY)})` : ' (All FYs)'}`
            : `${total} invoice${total !== 1 ? 's' : ''} in Recycle Bin`
        }
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'bin' && binCount > 0 && (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={13} />}
                onClick={handleEmptyBin}
              >
                Empty Bin
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download size={13} />}
              onClick={handleExport}
              isLoading={isExporting}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => navigate('/invoices/new')}
            >
              New Invoice
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-orion-border bg-white px-4 rounded-t-lg">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'active'
                ? 'border-orion-primary text-orion-primary font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText size={16} />
            <span>Active Invoices</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bin')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'bin'
                ? 'border-red-600 text-red-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Trash2 size={16} />
            <span>Recycle Bin</span>
            {binCount > 0 && (
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                activeTab === 'bin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {binCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'bin' && (
          <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded border border-amber-200 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            <span>Stock & ledger entries are reversed while invoices remain in the bin.</span>
          </div>
        )}
      </div>

      <div className="bg-white border border-orion-border rounded-b-lg shadow-orion -mt-4">
        <div className="p-4 border-b border-orion-border flex items-center justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={activeTab === 'active' ? 'Search active invoices...' : 'Search binned invoices...'}
            className="max-w-xs"
          />
        </div>

        {isLoading ? (
          <LoadingState fullHeight />
        ) : (
          <Table
            columns={activeTab === 'active' ? activeColumns : binColumns}
            data={invoices}
            keyExtractor={(inv) => inv.id}
            onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
            emptyState={
              <EmptyState
                icon={activeTab === 'active' ? <FileText size={32} /> : <Archive size={32} />}
                title={activeTab === 'active' ? 'No invoices found' : 'Recycle Bin is empty'}
                description={
                  activeTab === 'active'
                    ? 'Create your first invoice to get started.'
                    : 'Deleted invoices will appear here. You can restore them anytime or delete them permanently.'
                }
                action={
                  activeTab === 'active'
                    ? { label: 'Create Invoice', onClick: () => navigate('/invoices/new') }
                    : undefined
                }
              />
            }
          />
        )}

        <Pagination
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Edit Invoice Number Modal */}
      {editNumberInvoice && (
        <Modal
          open={!!editNumberInvoice}
          onClose={() => setEditNumberInvoice(null)}
          title="Change Invoice Number"
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setEditNumberInvoice(null)}
                disabled={isUpdatingNumber}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveInvoiceNumber}
                isLoading={isUpdatingNumber}
              >
                Save Invoice Number
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Update the invoice number for this document. All connected customer ledger records, inventory movements, and audit trails will be synchronized automatically.
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Current Invoice Number
              </label>
              <div className="font-mono text-sm bg-gray-50 border border-gray-200 px-3 py-2 rounded text-gray-700">
                {editNumberInvoice.invoiceNumber}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New Invoice Number *
              </label>
              <Input
                value={newInvoiceNumber}
                onChange={(e) => {
                  setNewInvoiceNumber(e.target.value)
                  setUpdateNumberError('')
                }}
                placeholder="e.g. INV-2026-0042"
                autoFocus
              />
              {updateNumberError && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {updateNumberError}
                </p>
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
              <p className="font-semibold">Note on Invoice Numbers:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Invoice numbers must be unique across all invoices in your business.</li>
                <li>Changing the number does not alter dates, products, or tax calculations.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
