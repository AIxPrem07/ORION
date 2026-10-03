import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card } from '@components/ui/Card'
import LoadingState from '@components/ui/LoadingState'
import { useBusinessStore } from '@store/business.store'
import { useNotificationStore } from '@store/notification.store'
import { getSupplier, createSupplier, updateSupplier } from '@services/supplier.service'
import { GST_STATES } from '@utils/gst-states'
import type { SupplierFormData } from '@/types/supplier'

const INITIAL: SupplierFormData = {
  name: '',
  supplierCode: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  stateCode: null,
  pin: '',
  gstin: '',
  pan: '',
  openingBalance: 0,
  paymentTerms: 0,
  notes: '',
}

export default function SupplierEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()

  const [form, setForm] = useState<SupplierFormData>(INITIAL)
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isNew || !business) return
    getSupplier(id!).then((s) => {
      if (s) {
        setForm({
          name: s.name,
          supplierCode: s.supplierCode ?? '',
          phone: s.phone ?? '',
          email: s.email ?? '',
          address: s.address ?? '',
          city: s.city ?? '',
          state: s.state ?? '',
          stateCode: s.stateCode,
          pin: s.pin ?? '',
          gstin: s.gstin ?? '',
          pan: s.pan ?? '',
          openingBalance: s.openingBalance,
          paymentTerms: s.paymentTerms,
          notes: s.notes ?? '',
        })
      }
      setIsLoading(false)
    })
  }, [id, isNew, business])

  function setField(key: keyof SupplierFormData, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!business) return
    if (!form.name.trim()) {
      error('Supplier name is required')
      return
    }
    setIsSaving(true)
    try {
      if (isNew) {
        const created = await createSupplier(business.id, form)
        success('Supplier created', created.name)
        navigate(`/suppliers/${created.id}`)
      } else {
        const updated = await updateSupplier(id!, business.id, form)
        success('Supplier updated', updated.name)
        navigate(`/suppliers/${updated.id}`)
      }
    } catch (err) {
      error('Failed to save supplier', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingState fullHeight />

  const STATE_OPTIONS = GST_STATES.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` }))

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? 'New Supplier' : 'Edit Supplier'}
        breadcrumb={[{ label: 'Suppliers' }, { label: isNew ? 'New' : form.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>Back</Button>
            <Button variant="primary" size="sm" isLoading={isSaving} leftIcon={<Save size={14} />} onClick={handleSave}>Save Supplier</Button>
          </div>
        }
      />
      <Card>
        <h3 className="text-sm font-semibold mb-4">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Supplier / Company Name" required value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Reliance Wholesale" />
          <Input label="Supplier Code" value={form.supplierCode ?? ''} onChange={(e) => setField('supplierCode', e.target.value)} placeholder="e.g. SUP-001" />
          <Input label="Phone Number" value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} />
          <Input label="Email Address" type="email" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
          <Input label="GSTIN" value={form.gstin ?? ''} onChange={(e) => setField('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
          <Input label="PAN" value={form.pan ?? ''} onChange={(e) => setField('pan', e.target.value)} />
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold mb-4">Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Address" value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} />
          </div>
          <Input label="City" value={form.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
          <Input label="PIN Code" value={form.pin ?? ''} onChange={(e) => setField('pin', e.target.value)} />
          <Select
            label="State"
            options={STATE_OPTIONS}
            placeholder="Select State..."
            value={form.stateCode ?? ''}
            onChange={(e) => {
              const state = GST_STATES.find((s) => s.code === e.target.value)
              setField('stateCode', e.target.value)
              setField('state', state?.name ?? '')
            }}
          />
        </div>
      </Card>
    </div>
  )
}
