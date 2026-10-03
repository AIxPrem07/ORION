import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, CheckCircle2, User, KeyRound, Eye, EyeOff, ShieldCheck, Copy, Check } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { useBusinessStore } from '@store/business.store'
import { useAuthStore } from '@store/auth.store'
import { useNotificationStore } from '@store/notification.store'
import { createBusinessWithOwner } from '@services/auth.service'
import { getBusiness } from '@services/business.service'
import { getActiveLicense } from '@/services/licensing.service'
import { GST_STATES } from '@utils/gst-states'
import type { BusinessFormData } from '@/types/business'

const INITIAL_FORM: BusinessFormData = {
  name: '', logoPath: null, address: '', city: '', state: '', stateCode: null,
  pin: '', phone: '', email: '', website: '', gstin: '', pan: '',
  bankName: '', accountNumber: '', ifsc: '', upiId: '',
  invoicePrefix: 'INV', financialYearStart: 4, signaturePath: null,
  termsAndConditions: 'Thank you for your business.',
}

export default function SetupWizard() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<BusinessFormData>(INITIAL_FORM)
  const [ownerName, setOwnerName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCreds, setCopiedCreds] = useState(false)

  const { setBusiness, setSetupComplete } = useBusinessStore()
  const { setSession } = useAuthStore()
  const { success, error } = useNotificationStore()
  const navigate = useNavigate()

  useEffect(() => {
    async function loadInitialData() {
      const lic = await getActiveLicense()
      const clientName = lic.clientName || ''
      const existing = await getBusiness()
      
      if (existing) {
        setForm((f) => ({
          ...f,
          name: existing.name || clientName,
          address: existing.address || '',
          city: existing.city || '',
          state: existing.state || '',
          stateCode: existing.stateCode,
          pin: existing.pin || '',
          phone: existing.phone || '',
          email: existing.email || '',
          website: existing.website || '',
          gstin: existing.gstin || '',
          pan: existing.pan || '',
          bankName: existing.bankName || '',
          accountNumber: existing.accountNumber || '',
          ifsc: existing.ifsc || '',
          upiId: existing.upiId || '',
          invoicePrefix: existing.invoicePrefix || 'INV',
        }))
        setOwnerName(existing.name || clientName)
        const defaultLogin = (existing.email || existing.name || clientName)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 16) || 'owner'
        setLoginId(defaultLogin)
      } else if (clientName) {
        setForm((f) => ({ ...f, name: clientName }))
        setOwnerName(clientName)
        const defaultLogin = clientName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 16) || 'owner'
        setLoginId(defaultLogin)
      }
    }
    loadInitialData()
  }, [])

  function setField(key: keyof BusinessFormData, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleFinish() {
    if (!form.name.trim()) {
      error('Business name is required')
      setStep(0)
      return
    }
    if (!ownerName.trim()) {
      error('Owner name is required')
      setStep(3)
      return
    }
    if (!loginId.trim()) {
      error('Login ID is required')
      setStep(3)
      return
    }
    if (!password || password.length < 4) {
      error('Password too short', 'Password must be at least 4 characters long')
      setStep(3)
      return
    }
    if (password !== confirmPassword) {
      error('Passwords do not match', 'Please ensure both passwords match')
      setStep(3)
      return
    }

    setIsLoading(true)
    try {
      const result = await createBusinessWithOwner({
        businessName: form.name.trim(),
        ownerName: ownerName.trim(),
        loginId: loginId.trim(),
        password: password.trim(),
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        stateCode: form.stateCode || undefined,
        pin: form.pin || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        gstin: form.gstin || undefined,
        pan: form.pan || undefined,
        bankName: form.bankName || undefined,
        accountNumber: form.accountNumber || undefined,
        ifsc: form.ifsc || undefined,
        upiId: form.upiId || undefined,
        invoicePrefix: form.invoicePrefix || 'INV',
      })

      // Set business in store and start user session immediately
      setBusiness(result.business)
      setSession(result.user, result.business)
      setSetupComplete(true)
      setStep(4) // Success step
    } catch (err: unknown) {
      console.error('[SetupWizard] Setup failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      error('Setup failed', message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  function handleCopyCredentials() {
    const credText = `ORION Login Credentials:\nBusiness: ${form.name}\nLogin ID: ${loginId}\nPassword: ${password}`
    navigator.clipboard.writeText(credText)
    setCopiedCreds(true)
    setTimeout(() => setCopiedCreds(false), 2000)
    success('Credentials Copied', 'Your login ID and password were saved to clipboard.')
  }

  if (step === 4) {
    return (
      <div className="min-h-screen bg-orion-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-orion-lg p-8 max-w-md w-full text-center border border-orion-border">
          <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-4 border border-green-100">
            <CheckCircle2 size={32} />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-1">You are all set!</h1>
          <p className="text-xs text-gray-500 mb-5">
            <strong>{form.name}</strong> is completely configured and ready.
          </p>

          {/* Credentials Card */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-left mb-6 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-600" />
                Your Permanent Login Credentials
              </span>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                {copiedCreds ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                {copiedCreds ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="text-xs font-mono text-gray-800 space-y-1 pt-1">
              <div>Business: <strong className="font-sans text-gray-900">{form.name}</strong></div>
              <div>Login ID: <strong className="text-indigo-700">{loginId}</strong></div>
              <div>Password: <strong className="text-gray-900">{password}</strong></div>
            </div>

            <p className="text-[11px] text-gray-500 pt-1">
              You can log in anytime using this Login ID and password.
            </p>
          </div>

          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Open Billing Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const STATE_OPTIONS = GST_STATES.map((s) => ({ value: s.code, label: s.name }))
  const stepLabels = ['Business Details', 'Address & GST', 'Bank Details', 'User ID & Password']

  return (
    <div className="min-h-screen bg-orion-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-orion-lg w-full max-w-lg border border-orion-border overflow-hidden">
        {/* Step Indicator */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-gray-200 shadow-xs bg-white shrink-0">
              <img src="/logo.png" alt="ORION" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Set Up Your Account</h1>
              <p className="text-xs text-gray-500">Enter your business details and create your login credentials</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 text-xs">
            {stepLabels.map((s, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  i < step ? 'bg-emerald-100 text-emerald-800 font-bold' : i === step ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${i === step ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>{s}</span>
                {i < 3 && <ChevronRight size={12} className="text-gray-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="px-8 pb-8">
          {step === 0 && (
            <div className="space-y-4">
              <Input
                label="Business Brand Name"
                required
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Sharma Traders or Balaji Garments"
                hint="Your business or brand name that appears on invoices"
                autoFocus
              />
              <Input
                label="Invoice Prefix"
                value={form.invoicePrefix ?? 'INV'}
                onChange={(e) => setField('invoicePrefix', e.target.value)}
                hint="Used in invoice numbers: INV/26-27/0001"
              />
              <Input
                label="Phone Number"
                value={form.phone ?? ''}
                onChange={(e) => setField('phone', e.target.value)}
                type="tel"
                placeholder="+91 98765 43210"
              />
              <Input
                label="Business Email"
                value={form.email ?? ''}
                onChange={(e) => setField('email', e.target.value)}
                type="email"
                placeholder="billing@yourbrand.com"
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Registered Business Address"
                value={form.address ?? ''}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Shop No, Complex, Street"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  value={form.city ?? ''}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="e.g. Surat"
                />
                <Input
                  label="PIN Code"
                  value={form.pin ?? ''}
                  onChange={(e) => setField('pin', e.target.value)}
                  placeholder="395002"
                />
              </div>
              <Select
                label="State"
                options={STATE_OPTIONS}
                placeholder="Select GST state..."
                value={form.stateCode ?? ''}
                onChange={(e) => {
                  const s = GST_STATES.find((g) => g.code === e.target.value)
                  setField('stateCode', e.target.value)
                  setField('state', s?.name ?? '')
                }}
              />
              <Input
                label="GSTIN (Optional)"
                value={form.gstin ?? ''}
                onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
                placeholder="24AAAAA0000A1Z5"
                hint="Leave empty if composition or unregistered"
              />
              <Input
                label="PAN Number (Optional)"
                value={form.pan ?? ''}
                onChange={(e) => setField('pan', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Input
                label="Bank Name"
                value={form.bankName ?? ''}
                onChange={(e) => setField('bankName', e.target.value)}
                placeholder="e.g. HDFC Bank, SBI"
              />
              <Input
                label="Account Number"
                value={form.accountNumber ?? ''}
                onChange={(e) => setField('accountNumber', e.target.value)}
                placeholder="50200012345678"
              />
              <Input
                label="IFSC Code"
                value={form.ifsc ?? ''}
                onChange={(e) => setField('ifsc', e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
              />
              <Input
                label="UPI ID (For dynamic invoice QR codes)"
                value={form.upiId ?? ''}
                onChange={(e) => setField('upiId', e.target.value)}
                placeholder="yourbusiness@upi"
                hint="Customers will scan this UPI QR on invoices to pay directly"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-900">
                <strong>Create your login credentials:</strong> You will use this Login ID and password to sign into ORION on this computer.
              </div>

              <Input
                label="Owner / User Full Name"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
              />

              <Input
                label="Login ID / Username"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. admin or owner"
                hint="Must be memorable. You will enter this on the login page."
              />

              <div className="relative">
                <Input
                  label="Create Password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  hint="Minimum 4 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <Input
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-orion-border">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>

            {step < 3 ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (step === 0 && !form.name.trim()) {
                    error('Business name is required')
                    return
                  }
                  setStep((s) => s + 1)
                }}
              >
                Next <ChevronRight size={14} />
              </Button>
            ) : (
              <Button
                variant="primary"
                isLoading={isLoading}
                onClick={handleFinish}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Finish Setup & Save
              </Button>
            )}
          </div>
        </div>

        {/* Setup Wizard Footer */}
        <div className="bg-gray-50/80 px-8 py-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span>&copy; 2026 ORION INC. All rights reserved.</span>
          <span>ORION Setup Wizard &bull; Version 1.0.0 Pro</span>
        </div>
      </div>
    </div>
  )
}
