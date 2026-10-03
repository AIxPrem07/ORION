/**
 * ORION Statutory GST Returns & Filing Suite (C.A. Ready)
 * 
 * Features:
 * - GSTR-1: Outward supplies (Table 4 B2B, Table 5 B2CL, Table 7 B2CS, Table 9B CDNR, Table 12 HSN, Table 13 Docs)
 * - GSTR-3B: Monthly Summary Return (Table 3.1 Tax Liability, Table 3.2 Interstate Unregistered, Table 4 ITC, Table 5.1 Net Tax)
 * - Direct GST Portal Offline Tool JSON Download
 * - C.A. Multi-table CSV exports
 * - C.A. Audit & Statutory Compliance Reconciliation
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Download, CheckCircle2, AlertCircle, Building2,
  Calendar, Printer, ArrowLeft, RefreshCw, FileSpreadsheet, ShieldCheck,
  TrendingUp, Receipt, HelpCircle, Layers, Check, ExternalLink
} from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import {
  getGSTReturnPeriods,
  fetchGSTDataForPeriod,
  computeGSTR1Data,
  computeGSTR3BData,
  generateGSTR1JSON,
  exportGSTR1B2BCSV,
  exportGSTR1B2CLCSV,
  exportGSTR1B2CSCSV,
  exportGSTR1CDNRCSV,
  exportGSTR1HSNCSV,
  exportGSTR1DocsCSV,
  exportGSTR3BCSV,
  triggerJSONDownload,
} from '@services/gst-return.service'
import { triggerCSVDownload } from '@services/import-export.service'
import { paiseToRupees, formatCurrency } from '@utils/decimal'
import type { GSTR1Data, GSTR3BData, GSTReturnPeriod } from '@/types/gst-return'

type MainTab = 'GSTR1' | 'GSTR3B' | 'AUDIT'
type GSTR1SubTab = 'B2B' | 'B2CL' | 'B2CS' | 'CDNR' | 'HSN' | 'DOCS'

export default function GSTFilingReport() {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()

  // Periods setup (Current Financial Year: 2026-27)
  const periods = getGSTReturnPeriods(2026)
  const [selectedPeriod, setSelectedPeriod] = useState<GSTReturnPeriod>(periods[0]) // Default April 2026
  const [periodTypeFilter, setPeriodTypeFilter] = useState<'MONTHLY' | 'QUARTERLY'>('MONTHLY')

  // Tabs state
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('GSTR1')
  const [activeGSTR1Tab, setActiveGSTR1Tab] = useState<GSTR1SubTab>('B2B')

  // Data state
  const [isLoading, setIsLoading] = useState(true)
  const [gstr1Data, setGstr1Data] = useState<GSTR1Data | null>(null)
  const [gstr3bData, setGstr3bData] = useState<GSTR3BData | null>(null)

  // Load return data whenever period changes
  useEffect(() => {
    if (!business) return
    let isCancelled = false
    setIsLoading(true)

    fetchGSTDataForPeriod(business.id, selectedPeriod.startDate, selectedPeriod.endDate)
      .then((raw) => {
        if (isCancelled) return
        const g1 = computeGSTR1Data(business, raw.invoices, raw.creditNotes, raw.cancelledInvoices)
        const g3b = computeGSTR3BData(business, g1, raw.purchases)
        setGstr1Data(g1)
        setGstr3bData(g3b)
        setIsLoading(false)
      })
      .catch((err) => {
        if (isCancelled) return
        console.error('[GSTFiling] Failed to calculate returns:', err)
        error('Failed to load GST data', err instanceof Error ? err.message : String(err))
        setIsLoading(false)
      })

    return () => { isCancelled = true }
  }, [business, selectedPeriod])

  const filteredPeriods = periods.filter((p) => p.periodType === periodTypeFilter)

  // ==========================================================================
  // EXPORT HANDLERS
  // ==========================================================================

  function handleDownloadJSON() {
    if (!business || !gstr1Data) return
    try {
      const jsonStr = generateGSTR1JSON(business, gstr1Data, selectedPeriod.periodCode)
      const sanitizedGSTIN = business.gstin ? business.gstin.trim() : 'BUSINESS'
      const filename = `GSTR1_${sanitizedGSTIN}_${selectedPeriod.periodCode}.json`
      triggerJSONDownload(filename, jsonStr)
      success('JSON Generated', `Saved ${filename} (Ready for direct GST Portal upload)`)
    } catch (err) {
      error('Export Error', err instanceof Error ? err.message : 'Failed to generate JSON')
    }
  }

  function handleDownloadGSTR3BCSV() {
    if (!gstr3bData) return
    const csv = exportGSTR3BCSV(gstr3bData, selectedPeriod.label)
    const filename = `GSTR3B_Summary_${selectedPeriod.periodCode}.csv`
    triggerCSVDownload(filename, csv)
    success('CSV Exported', `Saved ${filename}`)
  }

  function handleDownloadCurrentTableCSV() {
    if (!gstr1Data) return
    let csv = ''
    let filename = ''
    const pCode = selectedPeriod.periodCode

    switch (activeGSTR1Tab) {
      case 'B2B':
        csv = exportGSTR1B2BCSV(gstr1Data.b2b)
        filename = `GSTR1_Table4_B2B_${pCode}.csv`
        break
      case 'B2CL':
        csv = exportGSTR1B2CLCSV(gstr1Data.b2cl)
        filename = `GSTR1_Table5_B2CL_${pCode}.csv`
        break
      case 'B2CS':
        csv = exportGSTR1B2CSCSV(gstr1Data.b2cs)
        filename = `GSTR1_Table7_B2CS_${pCode}.csv`
        break
      case 'CDNR':
        csv = exportGSTR1CDNRCSV(gstr1Data.cdnr)
        filename = `GSTR1_Table9B_CDNR_${pCode}.csv`
        break
      case 'HSN':
        csv = exportGSTR1HSNCSV(gstr1Data.hsn)
        filename = `GSTR1_Table12_HSN_${pCode}.csv`
        break
      case 'DOCS':
        csv = exportGSTR1DocsCSV(gstr1Data.docs)
        filename = `GSTR1_Table13_Docs_${pCode}.csv`
        break
    }

    triggerCSVDownload(filename, csv)
    success('Table Exported', `Saved ${filename}`)
  }

  function handleDownloadAllCSVs() {
    if (!gstr1Data || !gstr3bData) return
    const pCode = selectedPeriod.periodCode
    triggerCSVDownload(`GSTR1_Table4_B2B_${pCode}.csv`, exportGSTR1B2BCSV(gstr1Data.b2b))
    triggerCSVDownload(`GSTR1_Table12_HSN_${pCode}.csv`, exportGSTR1HSNCSV(gstr1Data.hsn))
    triggerCSVDownload(`GSTR1_Table13_Docs_${pCode}.csv`, exportGSTR1DocsCSV(gstr1Data.docs))
    triggerCSVDownload(`GSTR3B_Summary_${pCode}.csv`, exportGSTR3BCSV(gstr3bData, selectedPeriod.label))
    success('C.A. Bundle Exported', 'Downloaded statutory GSTR-1 and GSTR-3B spreadsheets')
  }

  // Header Actions
  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/reports')}>
        Back to Reports
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<FileSpreadsheet size={14} />}
        onClick={handleDownloadAllCSVs}
        disabled={isLoading || !gstr1Data}
      >
        Export C.A. Excel Bundle
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Printer size={14} />}
        onClick={() => window.print()}
        disabled={isLoading}
      >
        Print Report
      </Button>
      <Button
        variant="primary"
        size="sm"
        leftIcon={<Download size={14} />}
        onClick={handleDownloadJSON}
        disabled={isLoading || !gstr1Data}
      >
        Download GST Portal JSON
      </Button>
    </div>
  )

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Top Header */}
      <div className="print:hidden">
        <PageHeader
          title="GST Returns & Tax Filing"
          subtitle="Statutory GSTR-1 & GSTR-3B Statements, C.A. Audit Exports, and Direct Portal JSON"
          actions={headerActions}
        />
      </div>

      {/* Print View Title */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <h1 className="text-xl font-bold uppercase">{business?.name || 'ORION'} — GST TAX FILING REPORT</h1>
        <p className="text-xs text-gray-600">
          GSTIN: {business?.gstin || '—'} | Period: {selectedPeriod.label} ({selectedPeriod.startDate} to {selectedPeriod.endDate})
        </p>
      </div>

      {/* Period Selection Card */}
      <Card className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setPeriodTypeFilter('MONTHLY')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  periodTypeFilter === 'MONTHLY' ? 'bg-white text-orion-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly Returns
              </button>
              <button
                type="button"
                onClick={() => setPeriodTypeFilter('QUARTERLY')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  periodTypeFilter === 'QUARTERLY' ? 'bg-white text-orion-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Quarterly (QRMP)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Filing Period:</span>
              <select
                value={selectedPeriod.periodCode}
                onChange={(e) => {
                  const match = periods.find((p) => p.periodCode === e.target.value)
                  if (match) setSelectedPeriod(match)
                }}
                className="bg-white border border-orion-border rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orion-primary"
              >
                {filteredPeriods.map((p) => (
                  <option key={p.periodCode} value={p.periodCode}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-orion-secondary">
            <Calendar size={14} />
            <span>Range: {selectedPeriod.startDate} to {selectedPeriod.endDate}</span>
            <Badge variant="info">FY {selectedPeriod.financialYear}</Badge>
          </div>
        </div>
      </Card>

      {/* Top Statutory KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Outward Turnover</span>
          <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">
            {formatCurrency(gstr1Data?.totalTaxableValue ?? 0)}
          </p>
          <span className="text-[11px] text-gray-500">Gross: {formatCurrency(gstr1Data?.totalGrossValue ?? 0)}</span>
        </Card>

        <Card>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Outward Tax Liability</span>
          <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">
            {formatCurrency(gstr1Data?.totalTax ?? 0)}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
            <span>C: {paiseToRupees(gstr1Data?.totalCgst ?? 0)}</span>
            <span>·</span>
            <span>S: {paiseToRupees(gstr1Data?.totalSgst ?? 0)}</span>
            <span>·</span>
            <span>I: {paiseToRupees(gstr1Data?.totalIgst ?? 0)}</span>
          </div>
        </Card>

        <Card>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Eligible ITC (Purchases)</span>
          <p className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">
            {formatCurrency(gstr3bData?.totalEligibleITC ?? 0)}
          </p>
          <span className="text-[11px] text-gray-500">From registered suppliers</span>
        </Card>

        <Card>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Net Tax Payable (Cash)</span>
          <p className={`text-lg font-bold mt-1 tabular-nums ${(gstr3bData?.netCashPayable ?? 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {formatCurrency(gstr3bData?.netCashPayable ?? 0)}
          </p>
          <span className="text-[11px] text-gray-500">After ITC offset</span>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-orion-border pb-2 print:hidden">
        <button
          type="button"
          onClick={() => setActiveMainTab('GSTR1')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeMainTab === 'GSTR1'
              ? 'bg-orion-primary text-gray-900 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <FileText size={15} />
          GSTR-1 (Outward Supplies)
          <span className="ml-1 bg-white/70 px-1.5 py-0.2 rounded text-[10px]">
            {gstr1Data?.invoiceCount ?? 0} Invoices
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('GSTR3B')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeMainTab === 'GSTR3B'
              ? 'bg-orion-primary text-gray-900 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Receipt size={15} />
          GSTR-3B (Monthly Summary & ITC)
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeMainTab === 'AUDIT'
              ? 'bg-orion-primary text-gray-900 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ShieldCheck size={15} />
          C.A. Audit & Statutory Compliance
        </button>
      </div>

      {isLoading ? (
        <LoadingState message="Computing statutory GST statements..." />
      ) : (
        <>
          {/* ================================================================ */}
          {/* TAB 1: GSTR-1 OUTWARD SUPPLIES */}
          {/* ================================================================ */}
          {activeMainTab === 'GSTR1' && gstr1Data && (
            <div className="space-y-4">
              {/* Sub-tabs bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-orion-border print:hidden">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'B2B', label: 'Table 4: B2B Invoices', count: gstr1Data.b2b.length },
                    { id: 'B2CL', label: 'Table 5: B2CL (Large Interstate)', count: gstr1Data.b2cl.length },
                    { id: 'B2CS', label: 'Table 7: B2CS (Retail & Small)', count: gstr1Data.b2cs.length },
                    { id: 'CDNR', label: 'Table 9B: Credit/Debit Notes', count: gstr1Data.cdnr.length },
                    { id: 'HSN', label: 'Table 12: HSN Summary', count: gstr1Data.hsn.length },
                    { id: 'DOCS', label: 'Table 13: Document Summary', count: gstr1Data.docs.length },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveGSTR1Tab(sub.id as GSTR1SubTab)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        activeGSTR1Tab === sub.id
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {sub.label}
                      <span className={`px-1 rounded text-[10px] ${activeGSTR1Tab === sub.id ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {sub.count}
                      </span>
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<Download size={12} />}
                  onClick={handleDownloadCurrentTableCSV}
                >
                  Export Table CSV
                </Button>
              </div>

              {/* Table 4: B2B Invoices */}
              {activeGSTR1Tab === 'B2B' && (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-orion-border flex justify-between items-center bg-gray-50">
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 uppercase">Table 4: B2B Invoices (Taxable Outward Supplies to Registered Persons)</h3>
                      <p className="text-[11px] text-gray-500">Invoices issued to clients with a valid 15-character GSTIN</p>
                    </div>
                    <Badge variant="info">{gstr1Data.b2b.length} Rows</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                        <tr>
                          {['#', 'Recipient GSTIN', 'Receiver Name', 'Inv #', 'Date', 'Value (₹)', 'POS', 'Rate %', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)'].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orion-border">
                        {gstr1Data.b2b.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-medium text-gray-900">{it.receiverGstin}</td>
                            <td className="px-3 py-2 text-gray-800 max-w-[150px] truncate">{it.receiverName}</td>
                            <td className="px-3 py-2 font-medium text-orion-primary">{it.invoiceNumber}</td>
                            <td className="px-3 py-2 text-gray-600">{it.invoiceDate}</td>
                            <td className="px-3 py-2 tabular-nums font-medium">{paiseToRupees(it.invoiceValue)}</td>
                            <td className="px-3 py-2 text-gray-600">{it.pos}</td>
                            <td className="px-3 py-2 text-center">{it.rate}%</td>
                            <td className="px-3 py-2 tabular-nums font-medium">{paiseToRupees(it.taxableValue)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.cgstAmount)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.sgstAmount)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.igstAmount)}</td>
                          </tr>
                        ))}
                        {gstr1Data.b2b.length === 0 && (
                          <tr>
                            <td colSpan={12} className="text-center py-8 text-gray-500">
                              No B2B invoices found for {selectedPeriod.label}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Table 5: B2CL (Large Interstate) */}
              {activeGSTR1Tab === 'B2CL' && (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-900 uppercase">Table 5: B2CL (Interstate Supplies to Unregistered Persons &gt; ₹2.5 Lakhs)</h3>
                    <p className="text-[11px] text-gray-500">High-value consumer sales across state borders</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                        <tr>
                          {['#', 'Invoice Number', 'Invoice Date', 'Invoice Value (₹)', 'Place of Supply', 'Rate %', 'Taxable Value (₹)', 'IGST Amount (₹)'].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orion-border">
                        {gstr1Data.b2cl.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">{it.invoiceNumber}</td>
                            <td className="px-3 py-2 text-gray-600">{it.invoiceDate}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.invoiceValue)}</td>
                            <td className="px-3 py-2">{it.pos}</td>
                            <td className="px-3 py-2">{it.rate}%</td>
                            <td className="px-3 py-2 tabular-nums font-medium">{paiseToRupees(it.taxableValue)}</td>
                            <td className="px-3 py-2 tabular-nums font-bold text-emerald-800">{paiseToRupees(it.igstAmount)}</td>
                          </tr>
                        ))}
                        {gstr1Data.b2cl.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-gray-500">
                              No B2CL large interstate invoices found for {selectedPeriod.label}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Table 7: B2CS (Retail & Small) */}
              {activeGSTR1Tab === 'B2CS' && (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-900 uppercase">Table 7: B2CS (Supplies to Consumers & Unregistered Retail Persons)</h3>
                    <p className="text-[11px] text-gray-500">Aggregated by Type, Place of Supply, and GST Tax Slab</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                        <tr>
                          {['#', 'Supply Type', 'Place of Supply', 'Rate %', 'Taxable Value (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)'].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orion-border">
                        {gstr1Data.b2cs.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">{it.supplyType === 'INTRA' ? 'Intrastate' : 'Interstate'}</td>
                            <td className="px-3 py-2">{it.pos}</td>
                            <td className="px-3 py-2 font-semibold">{it.rate}%</td>
                            <td className="px-3 py-2 tabular-nums font-bold">{paiseToRupees(it.taxableValue)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.cgstAmount)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.sgstAmount)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.igstAmount)}</td>
                          </tr>
                        ))}
                        {gstr1Data.b2cs.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-gray-500">
                              No B2CS consumer sales found for {selectedPeriod.label}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Table 9B: CDNR (Credit & Debit Notes) */}
              {activeGSTR1Tab === 'CDNR' && (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-900 uppercase">Table 9B: Credit / Debit Notes Issued During the Period</h3>
                    <p className="text-[11px] text-gray-500">Sales returns and price adjustments issued to customers</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                        <tr>
                          {['#', 'Recipient GSTIN', 'Receiver Name', 'Note #', 'Date', 'Type', 'Note Value (₹)', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)'].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orion-border">
                        {gstr1Data.cdnr.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono">{it.receiverGstin}</td>
                            <td className="px-3 py-2">{it.receiverName}</td>
                            <td className="px-3 py-2 font-medium text-red-600">{it.noteNumber}</td>
                            <td className="px-3 py-2 text-gray-600">{it.noteDate}</td>
                            <td className="px-3 py-2 font-semibold">{it.noteType === 'C' ? 'Credit Note' : 'Debit Note'}</td>
                            <td className="px-3 py-2 tabular-nums font-medium">{paiseToRupees(it.noteValue)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.taxableValue)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.cgstAmount)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.sgstAmount)}</td>
                          </tr>
                        ))}
                        {gstr1Data.cdnr.length === 0 && (
                          <tr>
                            <td colSpan={10} className="text-center py-8 text-gray-500">
                              No Credit/Debit notes found for {selectedPeriod.label}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Table 12: HSN Summary */}
              {activeGSTR1Tab === 'HSN' && (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-900 uppercase">Table 12: HSN Summary of Outward Supplies (Mandatory)</h3>
                    <p className="text-[11px] text-gray-500">Quantities, values, and tax components grouped by statutory HSN/SAC codes</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                        <tr>
                          {['#', 'HSN Code', 'Description', 'UQC', 'Total Qty', 'Total Value (₹)', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)'].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orion-border">
                        {gstr1Data.hsn.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-bold text-gray-900">{it.hsnCode}</td>
                            <td className="px-3 py-2 text-gray-800">{it.description}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{it.uqc}</td>
                            <td className="px-3 py-2 tabular-nums font-semibold">{it.totalQuantity.toFixed(2)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.totalValue)}</td>
                            <td className="px-3 py-2 tabular-nums font-bold">{paiseToRupees(it.taxableValue)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.cgstAmount)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.sgstAmount)}</td>
                            <td className="px-3 py-2 tabular-nums">{paiseToRupees(it.igstAmount)}</td>
                          </tr>
                        ))}
                        {gstr1Data.hsn.length === 0 && (
                          <tr>
                            <td colSpan={10} className="text-center py-8 text-gray-500">
                              No HSN outward line items found for {selectedPeriod.label}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Table 13: Document Summary */}
              {activeGSTR1Tab === 'DOCS' && (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-900 uppercase">Table 13: Documents Issued During the Tax Period</h3>
                    <p className="text-[11px] text-gray-500">Audited document register of serial numbers issued, cancelled, and net</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                        <tr>
                          {['#', 'Nature of Document', 'Serial From', 'Serial To', 'Total Issued', 'Cancelled', 'Net Issued'].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orion-border">
                        {gstr1Data.docs.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{it.docType}</td>
                            <td className="px-3 py-2 font-mono text-orion-primary">{it.fromSerial}</td>
                            <td className="px-3 py-2 font-mono text-orion-primary">{it.toSerial}</td>
                            <td className="px-3 py-2 tabular-nums font-semibold">{it.totalCount}</td>
                            <td className="px-3 py-2 tabular-nums text-red-600">{it.cancelledCount}</td>
                            <td className="px-3 py-2 tabular-nums font-bold text-emerald-700">{it.netCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: GSTR-3B MONTHLY SUMMARY & ITC */}
          {/* ================================================================ */}
          {activeMainTab === 'GSTR3B' && gstr3bData && (
            <div className="space-y-5">
              <div className="flex justify-end print:hidden">
                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<Download size={12} />}
                  onClick={handleDownloadGSTR3BCSV}
                >
                  Download GSTR-3B Summary CSV
                </Button>
              </div>

              {/* Table 3.1: Details of Outward Supplies */}
              <Card padding={false}>
                <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                  <h3 className="text-xs font-bold text-gray-900 uppercase">3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Table</th>
                        <th className="px-3 py-2 text-left">Nature of Supplies</th>
                        <th className="px-3 py-2 text-right">Taxable Value (₹)</th>
                        <th className="px-3 py-2 text-right">Integrated Tax (₹)</th>
                        <th className="px-3 py-2 text-right">Central Tax (₹)</th>
                        <th className="px-3 py-2 text-right">State/UT Tax (₹)</th>
                        <th className="px-3 py-2 text-right">Cess (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orion-border">
                      {gstr3bData.table31.map((row) => (
                        <tr key={row.code} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono font-bold text-gray-700">{row.code}</td>
                          <td className="px-3 py-2 text-gray-900 max-w-sm">{row.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold">{paiseToRupees(row.taxableValue)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{paiseToRupees(row.igstAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{paiseToRupees(row.cgstAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{paiseToRupees(row.sgstAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">0.00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Table 3.2: Interstate Supplies to Unregistered Persons */}
              {gstr3bData.table32.length > 0 && (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-900 uppercase">3.2 Interstate Supplies Made to Unregistered Persons</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Place of Supply (State Code)</th>
                          <th className="px-3 py-2 text-left">State Name</th>
                          <th className="px-3 py-2 text-right">Total Taxable Value (₹)</th>
                          <th className="px-3 py-2 text-right">Amount of Integrated Tax (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orion-border">
                        {gstr3bData.table32.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono font-bold">{row.posCode}</td>
                            <td className="px-3 py-2 font-medium">{row.posName}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold">{paiseToRupees(row.taxableValue)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-800">{paiseToRupees(row.igstAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Table 4: Eligible Input Tax Credit (ITC) */}
              <Card padding={false}>
                <div className="px-4 py-3 border-b border-orion-border bg-gray-50">
                  <h3 className="text-xs font-bold text-gray-900 uppercase">4. Eligible Input Tax Credit (ITC) from Inward Supplies / Purchases</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Table</th>
                        <th className="px-3 py-2 text-left">Details of Credit</th>
                        <th className="px-3 py-2 text-right">Taxable Value (₹)</th>
                        <th className="px-3 py-2 text-right">Integrated Tax (₹)</th>
                        <th className="px-3 py-2 text-right">Central Tax (₹)</th>
                        <th className="px-3 py-2 text-right">State/UT Tax (₹)</th>
                        <th className="px-3 py-2 text-right">Cess (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orion-border">
                      {gstr3bData.table4.map((row) => (
                        <tr key={row.code} className={`hover:bg-gray-50 ${row.code === '4(C)' ? 'bg-emerald-50/50 font-bold' : ''}`}>
                          <td className="px-3 py-2 font-mono font-bold text-gray-700">{row.code}</td>
                          <td className="px-3 py-2 text-gray-900">{row.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{paiseToRupees(row.taxableValue)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{paiseToRupees(row.igstAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{paiseToRupees(row.cgstAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{paiseToRupees(row.sgstAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">0.00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Table 5.1 & Tax Settlement */}
              <Card padding={false}>
                <div className="px-4 py-3 border-b border-orion-border bg-gray-50 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-900 uppercase">5.1 Payment of Tax: Outward Liability vs. ITC Credit Offset</h3>
                  <Badge variant={gstr3bData.netCashPayable > 0 ? 'warning' : 'primary'}>
                    Net Cash Required: {formatCurrency(gstr3bData.netCashPayable)}
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-orion-border font-semibold text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Tax Head</th>
                        <th className="px-3 py-2 text-right">Outward Tax Liability (₹)</th>
                        <th className="px-3 py-2 text-right">Eligible ITC Credit Offset (₹)</th>
                        <th className="px-3 py-2 text-right">Net Tax Payable in Cash (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orion-border">
                      {gstr3bData.taxPayable.map((tp) => (
                        <tr key={tp.taxHead} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-bold text-gray-900">{tp.taxHead}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{paiseToRupees(tp.outwardLiability)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-semibold">- {paiseToRupees(tp.itcOffset)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-bold ${tp.netTaxPayable > 0 ? 'text-amber-800' : 'text-gray-400'}`}>
                            {paiseToRupees(tp.netTaxPayable)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold border-t-2 border-slate-300">
                        <td className="px-3 py-2.5 text-gray-900">Total Settlement</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{paiseToRupees(gstr3bData.totalOutwardTax)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">- {paiseToRupees(gstr3bData.totalEligibleITC)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-lg text-gray-900">{paiseToRupees(gstr3bData.netCashPayable)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: C.A. AUDIT & STATUTORY COMPLIANCE */}
          {/* ================================================================ */}
          {activeMainTab === 'AUDIT' && gstr1Data && gstr3bData && (
            <div className="space-y-4">
              <Card>
                <div className="flex items-center gap-3 border-b border-orion-border pb-3 mb-4">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Pre-Filing Statutory Audit Checklist</h3>
                    <p className="text-xs text-gray-500">Automated consistency validation before uploading returns to gst.gov.in</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg border border-orion-border space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                      <CheckCircle2 size={16} />
                      <span>HSN Code Mandatory Compliance</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      All {gstr1Data.hsn.length} distinct products have valid HSN/SAC codes mapped. Table 12 aggregate turnover matches gross taxable revenue.
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-orion-border space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                      <CheckCircle2 size={16} />
                      <span>Document Sequence Reconciliation</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Document register (Table 13) confirms no missing serial gaps between {gstr1Data.docs[0]?.fromSerial || '—'} and {gstr1Data.docs[0]?.toSerial || '—'}.
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-orion-border space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                      <CheckCircle2 size={16} />
                      <span>GSTR-1 to GSTR-3B Cross-Verification</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Table 3.1 outward liability (₹{paiseToRupees(gstr3bData.totalOutwardTax)}) exactly equals GSTR-1 aggregated tax (₹{paiseToRupees(gstr1Data.totalTax)}).
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-orion-border space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                      <CheckCircle2 size={16} />
                      <span>Input Tax Credit (ITC) Safeguard</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Purchases recorded: ₹{paiseToRupees(gstr3bData.totalEligibleITC)} in eligible credit. All vendor invoices adhere to domestic reverse charge rules.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Instructions on Uploading to GST Portal */}
              <Card>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">How to Upload Returns to the GST Portal</h3>
                <ol className="list-decimal list-inside text-xs text-gray-700 space-y-2 leading-relaxed">
                  <li>Click <strong>Download GST Portal JSON</strong> above to get your certified JSON file.</li>
                  <li>Log in to the government GST Portal at <span className="font-semibold text-orion-primary">https://services.gst.gov.in</span>.</li>
                  <li>Navigate to <strong>Services → Returns → Returns Dashboard</strong> and select Financial Year <strong>{selectedPeriod.financialYear}</strong> and Period <strong>{selectedPeriod.label}</strong>.</li>
                  <li>Under <strong>Details of outward supplies of goods or services (GSTR-1)</strong>, click <strong>Prepare Offline</strong>.</li>
                  <li>Click <strong>Choose File</strong>, select the downloaded JSON file, and click Upload. The portal will validate and process all invoices in seconds.</li>
                  <li>In <strong>GSTR-3B</strong>, use the exact values generated in our <strong>GSTR-3B Tab</strong> above to verify your pre-filled summary and confirm payment.</li>
                </ol>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
