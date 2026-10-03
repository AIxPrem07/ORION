import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building, Sparkles, FileText, CreditCard, Settings as SettingsIcon } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Card } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Button } from '@components/ui/Button'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { updateBusiness } from '@services/business.service'
import { GST_STATES } from '@utils/gst-states'
import type { BusinessFormData } from '@/types/business'

export default function BusinessProfile() {
  const { business, setBusiness } = useBusinessStore()
  const { success, error } = useNotificationStore()
  const navigate = useNavigate()
  const [form, setForm] = useState<Partial<BusinessFormData>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (business) setForm(business as unknown as Partial<BusinessFormData>)
  }, [business])

  function setField(key: keyof BusinessFormData, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!business) return
    setIsSaving(true)
    try {
      const updated = await updateBusiness(business.id, form)
      setBusiness(updated)
      success('Business profile saved')
    } catch (err) {
      error('Failed to save', err instanceof Error ? err.message : 'Unknown error')
    } finally { setIsSaving(false) }
  }

  const STATE_OPTIONS = GST_STATES.map((s) => ({ value: s.code, label: s.name }))

  return (
    <div className="space-y-5">
      <PageHeader title="Business Profile"
        actions={<Button variant="primary" size="sm" isLoading={isSaving} onClick={handleSave}>Save Changes</Button>}
      />

      {/* Settings Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-orion-border pb-1 overflow-x-auto text-xs">
        <button
          onClick={() => navigate('/settings/profile')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold bg-gray-200 text-gray-900 transition-colors"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Basic Info</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Business Name" required value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} />
          <Input label="Invoice Prefix" value={form.invoicePrefix ?? 'INV'} onChange={(e) => setField('invoicePrefix', e.target.value)} hint="e.g. INV creates: INV/26-27/0001" />
          <Input label="Phone" value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} />
          <Input label="Email" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
          <Input label="GSTIN" value={form.gstin ?? ''} onChange={(e) => setField('gstin', e.target.value)} />
          <Input label="PAN" value={form.pan ?? ''} onChange={(e) => setField('pan', e.target.value)} />
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Input label="Address" value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} /></div>
          <Input label="City" value={form.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
          <Input label="PIN" value={form.pin ?? ''} onChange={(e) => setField('pin', e.target.value)} />
          <Select label="State" options={STATE_OPTIONS} placeholder="Select state..." value={form.stateCode ?? ''}
            onChange={(e) => { const s = GST_STATES.find((g) => g.code === e.target.value); setField('stateCode', e.target.value); setField('state', s?.name ?? '') }}
          />
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Banking</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Bank Name" value={form.bankName ?? ''} onChange={(e) => setField('bankName', e.target.value)} />
          <Input label="Account Number" value={form.accountNumber ?? ''} onChange={(e) => setField('accountNumber', e.target.value)} />
          <Input label="IFSC" value={form.ifsc ?? ''} onChange={(e) => setField('ifsc', e.target.value)} />
          <Input label="UPI ID" value={form.upiId ?? ''} onChange={(e) => setField('upiId', e.target.value)} />
        </div>
      </Card>
    </div>
  )
}
