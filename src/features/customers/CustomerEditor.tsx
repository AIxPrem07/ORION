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
import { getCustomer, createCustomer, updateCustomer } from '@services/customer.service'
import { GST_STATES } from '@utils/gst-states'
import type { CustomerFormData } from '@/types/customer'

const INITIAL: CustomerFormData = {
  name: '',
  customerCode: null,
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
  creditLimit: 0,
  paymentTerms: 0,
  notes: '',
}

export default function CustomerEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { success, error } = useNotificationStore()

  const [form, setForm] = useState<CustomerFormData>(INITIAL)
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isNew || !business) return
    getCustomer(id!).then((c) => {
      if (c) {
        setForm({
          name: c.name,
          customerCode: c.customerCode,
          phone: c.phone ?? '',
          email: c.email ?? '',
          address: c.address ?? '',
          city: c.city ?? '',
          state: c.state ?? '',
          stateCode: c.stateCode,
          pin: c.pin ?? '',
          gstin: c.gstin ?? '',
          pan: c.pan ?? '',
          openingBalance: c.openingBalance,
          creditLimit: c.creditLimit,
          paymentTerms: c.paymentTerms,
          notes: c.notes ?? '',
        })
      }
      setIsLoading(false)
    })
  }, [id, isNew, business])

  function setField(key: keyof CustomerFormData, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!business) return
    if (!form.name.trim()) {
      error('Customer name is required')
      return
    }
    setIsSaving(true)
    try {
      if (isNew) {
        const created = await createCustomer(business.id, form)
        success('Customer created', created.name)
        navigate(`/customers/${created.id}`)
      } else {
        const updated = await updateCustomer(id!, business.id, form)
        success('Customer updated', updated.name)
        navigate(`/customers/${updated.id}`)
      }
    } catch (err) {
      error('Failed to save customer', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingState fullHeight />

  const STATE_OPTIONS = GST_STATES.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` }))

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? 'New Customer' : 'Edit Customer'}
        breadcrumb={[{ label: 'Customers' }, { label: isNew ? 'New' : form.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>Back</Button>
            <Button variant="primary" size="sm" isLoading={isSaving} leftIcon={<Save size={14} />} onClick={handleSave}>Save Customer</Button>
          </div>
        }
      />
      <Card>
        <h3 className="text-sm font-semibold mb-4">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Customer / Business Name" required value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Acme Corp" />
          <Input label="Phone Number" value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} placeholder="10-digit mobile" />
          <Input label="Email Address" type="email" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
          <Input label="GSTIN" value={form.gstin ?? ''} onChange={(e) => setField('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
          <Input label="PAN" value={form.pan ?? ''} onChange={(e) => setField('pan', e.target.value)} placeholder="ABCDE1234F" />
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold mb-4">Billing Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Street Address" value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} />
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
