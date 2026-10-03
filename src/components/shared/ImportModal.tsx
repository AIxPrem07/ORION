import { useState, useRef } from 'react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Upload, Download, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  parseCSVToRows,
  generateCSV,
  triggerCSVDownload,
  importCustomersFromCSV,
  importProductsFromCSV,
  type ImportResult,
} from '@services/import-export.service'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'customers' | 'products'
  onSuccess: () => void
}

export function ImportModal({ isOpen, onClose, type, onSuccess }: ImportModalProps) {
  const { business } = useBusinessStore()
  const { addToast } = useNotificationStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [csvContent, setCsvContent] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<string[][]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const title = type === 'customers' ? 'Import Customers from CSV' : 'Import Products from CSV'

  const handleDownloadTemplate = () => {
    if (type === 'customers') {
      const headers = [
        'Customer Name',
        'Phone',
        'Email',
        'GSTIN',
        'PAN',
        'Address',
        'City',
        'State',
        'State Code',
        'PIN',
        'Opening Balance',
      ]
      const sample = [
        [
          'Apex Enterprises',
          '9876543210',
          'apex@example.com',
          '27AAPFU0939F1ZV',
          'AAPFU0939F',
          '101 Commerce Hub',
          'Mumbai',
          'Maharashtra',
          '27',
          '400001',
          '2500.00',
        ],
      ]
      triggerCSVDownload('customers_template.csv', generateCSV(headers, sample))
    } else {
      const headers = [
        'Product Name',
        'SKU',
        'HSN Code',
        'Selling Price',
        'Cost Price',
        'MRP',
        'GST %',
        'Opening Stock',
      ]
      const sample = [
        ['Precision Gear Box', 'PGB-001', '8483', '1500.00', '1100.00', '1800.00', '18', '50'],
      ]
      triggerCSVDownload('products_template.csv', generateCSV(headers, sample))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setCsvContent(content)
      try {
        const rows = parseCSVToRows(content)
        setParsedRows(rows)
      } catch (err) {
        addToast({
          type: 'error',
          title: 'CSV Parse Error',
          message: 'Could not read CSV file format.',
        })
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!business || !csvContent) return
    setIsLoading(true)
    setResult(null)

    try {
      let res: ImportResult
      if (type === 'customers') {
        res = await importCustomersFromCSV(csvContent, business.id)
      } else {
        res = await importProductsFromCSV(csvContent, business.id)
      }

      setResult(res)
      if (res.imported > 0) {
        addToast({
          type: 'success',
          title: 'Import Complete',
          message: `Successfully imported ${res.imported} item${res.imported !== 1 ? 's' : ''}.`,
        })
        onSuccess()
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Import Failed',
        message: err.message || 'An error occurred during import.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setCsvContent('')
    setFileName('')
    setParsedRows([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {/* Template download row */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-orion-border rounded text-xs">
          <div className="text-gray-600">
            Download our standard CSV format template before uploading your data.
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download size={13} />}
            onClick={handleDownloadTemplate}
          >
            Download Template
          </Button>
        </div>

        {/* File upload box */}
        {!csvContent ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-lg p-8 text-center cursor-pointer transition-colors bg-white"
          >
            <Upload size={32} className="mx-auto text-orion-secondary mb-2" />
            <div className="text-sm font-medium text-gray-900 mb-1">
              Click to select a CSV file
            </div>
            <div className="text-xs text-orion-secondary">
              Upload .csv files exported from Excel, Tally, or custom spreadsheets
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white border border-orion-border rounded">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-orion-secondary" />
                <div>
                  <div className="text-xs font-medium text-gray-900">{fileName}</div>
                  <div className="text-[11px] text-orion-secondary">
                    {parsedRows.length - 1} data row{parsedRows.length - 1 !== 1 ? 's' : ''} detected
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={isLoading}>
                Change File
              </Button>
            </div>

            {/* Preview table (first 5 rows) */}
            {parsedRows.length > 0 && (
              <div className="border border-orion-border rounded overflow-hidden">
                <div className="px-3 py-1.5 bg-gray-50 border-b border-orion-border text-[11px] font-medium text-gray-700">
                  Data Preview (Header + First {Math.min(5, parsedRows.length - 1)} rows)
                </div>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-gray-100 text-gray-600 font-medium border-b border-gray-200">
                      <tr>
                        {parsedRows[0]?.slice(0, 6).map((h, i) => (
                          <th key={i} className="px-2.5 py-1.5 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRows.slice(1, 6).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-gray-50">
                          {row.slice(0, 6).map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1.5 text-gray-800 whitespace-nowrap">
                              {cell || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results / Error reporting */}
            {result && (
              <div className="p-3 bg-gray-50 border border-orion-border rounded text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={15} className="text-green-600" />
                  <span>
                    Successfully imported {result.imported} of {result.totalRows} records.
                  </span>
                </div>
                {result.skipped > 0 && (
                  <div className="text-amber-700 text-[11px]">
                    {result.skipped} row{result.skipped !== 1 ? 's were' : ' was'} skipped (duplicates or missing required fields).
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 bg-white p-2 rounded border border-gray-200 text-[11px] text-red-600">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-orion-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {csvContent && !result && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleImport}
              isLoading={isLoading}
              leftIcon={<Upload size={13} />}
            >
              Import {parsedRows.length > 1 ? `${parsedRows.length - 1} Records` : ''}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
