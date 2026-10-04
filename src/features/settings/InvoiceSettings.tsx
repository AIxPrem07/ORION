import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Building, Settings as SettingsIcon, CreditCard, FileText } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Card } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Button } from '@components/ui/Button'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { getSequences } from '@services/invoice-number.service'
import { updateBusiness, getAppSetting, setAppSetting } from '@services/business.service'
import type { InvoiceSequence } from '@/types/invoice'
import type { InvoicePaperSize, InvoiceTheme } from '@/types/business'

export default function InvoiceSettings() {
  const { business, setBusiness } = useBusinessStore()
  const { success, error } = useNotificationStore()
  const navigate = useNavigate()
  const [sequences, setSequences] = useState<InvoiceSequence[]>([])
  const [prefix, setPrefix] = useState('')
  const [paperSize, setPaperSize] = useState<InvoicePaperSize>('A4')
  const [theme, setTheme] = useState<InvoiceTheme>('SLATE_BLUE')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (business) {
      setPrefix(business.invoicePrefix)
      getSequences(business.id).then(setSequences)
    }
    getAppSetting('invoice_paper_size').then((s) => {
      if (s === 'A4' || s === 'A5' || s === 'THERMAL') setPaperSize(s)
    })
    getAppSetting('invoice_theme').then((t) => {
      if (t === 'SLATE_BLUE' || t === 'CLASSIC_NAVY' || t === 'MONOCHROME' || t === 'EMERALD') setTheme(t)
    })
  }, [business])

  async function handleSave() {
    if (!business) return
    setIsSaving(true)
    try {
      const updated = await updateBusiness(business.id, { invoicePrefix: prefix })
      setBusiness(updated)
      await setAppSetting('invoice_paper_size', paperSize)
      await setAppSetting('invoice_theme', theme)
      success('Invoice settings saved successfully')
    } catch (err) {
      error('Save failed', err instanceof Error ? err.message : 'Unknown error')
    } finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoice Settings"
        actions={<Button variant="primary" size="sm" isLoading={isSaving} onClick={handleSave}>Save Settings</Button>}
      />

      {/* Settings Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-orion-border pb-1 overflow-x-auto text-xs">
        <button
          onClick={() => navigate('/settings/profile')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Building size={14} />
          Business Profile
        </button>
        <button
          onClick={() => navigate('/settings/edit-invoice')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 transition-colors"
        >
          <Sparkles size={14} />
          Edit Invoice (Studio)
        </button>
        <button
          onClick={() => navigate('/settings/invoice')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold bg-gray-200 text-gray-900 transition-colors"
        >
          <FileText size={14} />
          Sequences & Formats
        </button>
        <button
          onClick={() => navigate('/settings/backup')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <CreditCard size={14} />
          Backup & Data
        </button>
        <button
          onClick={() => navigate('/settings/app')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <SettingsIcon size={14} />
          App Settings
        </button>
      </div>

      {/* Flagship Banner / Shortcut to Edit Invoice Studio */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-300" />
            <h3 className="font-bold text-base text-white">Visual Studio: Edit Invoice Layout</h3>
            <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Flagship Studio
            </span>
          </div>
          <p className="text-xs text-indigo-200 mt-1 max-w-xl">
            Edit invoice elements with live Photoshop-style visual controls. Customize lines of columns and rows, upload brand logo, configure UPI QR code size, and customize bank details and terms.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate('/settings/edit-invoice')}
          className="bg-white text-indigo-900 font-bold hover:bg-indigo-50 border-none shadow-sm flex-shrink-0"
        >
          Open Visual Studio
        </Button>
      </div>

      {/* Invoice Layout & Format Card */}
      <Card>
        <h3 className="text-sm font-semibold mb-1 text-gray-900">Tax Invoice Format & Layout</h3>
        <p className="text-xs text-orion-secondary mb-4">
          Customize the default print paper size, visual theme palette, and grid styling for generated GST tax invoices.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Default Invoice Paper Size
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'A4', label: 'A4 Size', desc: 'Standard Full Page' },
                { id: 'LETTER', label: 'US Letter', desc: '8.5 x 11 in Standard' },
                { id: 'A5', label: 'A5 Size', desc: 'Compact Half Page' },
                { id: 'THERMAL', label: 'Thermal 80mm', desc: 'POS Receipt Slip' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaperSize(p.id as InvoicePaperSize)}
                  className={`p-3 text-left rounded-lg border text-xs transition-all ${
                    paperSize === p.id
                      ? 'border-orion-primary bg-blue-50/50 ring-2 ring-orion-primary text-gray-900'
                      : 'border-orion-border bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <p className="font-semibold text-xs">{p.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Default Color Palette & Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'SLATE_BLUE', label: 'Slate Blue', color: '#416788' },
                { id: 'CLASSIC_NAVY', label: 'Classic Navy', color: '#1E3A5F' },
                { id: 'MONOCHROME', label: 'B&W Monochrome', color: '#18191B' },
                { id: 'EMERALD', label: 'Emerald Green', color: '#047857' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as InvoiceTheme)}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs transition-all ${
                    theme === t.id
                      ? 'border-orion-primary bg-blue-50/50 ring-2 ring-orion-primary text-gray-900 font-medium'
                      : 'border-orion-border bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Invoice Numbering Card */}
      <Card>
        <h3 className="text-sm font-semibold mb-4 text-gray-900">Invoice Numbering</h3>
        <div className="max-w-xs">
          <Input label="Invoice Prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} hint="e.g. INV → INV/26-27/0001" />
        </div>
      </Card>

      {/* Active Sequences Card */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-orion-border">
          <h3 className="text-sm font-semibold text-gray-900">Active Sequences</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['Prefix', 'Financial Year', 'Current #', 'Padding'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-orion-secondary">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {sequences.map((seq) => (
              <tr key={seq.id} className="border-t border-orion-border">
                <td className="px-4 py-2.5 font-medium">{seq.prefix}</td>
                <td className="px-4 py-2.5">{seq.financialYear}</td>
                <td className="px-4 py-2.5 tabular-nums">{seq.currentNumber}</td>
                <td className="px-4 py-2.5">{seq.padding}</td>
              </tr>
            ))}
            {sequences.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-xs text-orion-secondary">No sequences yet. Create your first invoice to initialize.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
