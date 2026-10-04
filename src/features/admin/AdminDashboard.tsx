/**
 * ORION Master Administration Dashboard
 * 
 * Allows the administrator to:
 * - Generate authentic, offline-verifiable Product Keys for clients
 * - View & manage client Product Keys directory
 * - View all business profiles and active owners
 * - Create new business profiles with Login ID & Password
 * - Copy credentials with 1-click for sending to business owners
 * - Reset owner passwords with full control
 * - Toggle active/inactive status
 * - Jump directly into any business's billing dashboard ("Open Billing")
 * - Update and maintain permanent Master Admin credentials
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Plus, KeyRound, Copy, Check, ExternalLink,
  ShieldAlert, ShieldCheck, UserCheck, UserX, Settings, LogOut,
  Search, RefreshCw, Lock, Sparkles, FileText, IndianRupee,
  Laptop, CheckCircle2, Trash2, HelpCircle, ArrowRight
} from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import LoadingState from '@components/ui/LoadingState'
import { useAuthStore } from '@store/auth.store'
import { useNotificationStore } from '@store/notification.store'
import {
  listAllBusinessesWithOwners,
  createBusinessWithOwner,
  resetOwnerPassword,
  updateAdminCredentials,
  toggleUserStatus,
  type CreateBusinessProfileInput
} from '@services/auth.service'
import {
  generateProductKey,
  listAllProductKeys,
  deleteProductKey,
  type ProductKeyRecord,
  type LicensePlan,
  type LicenseEdition
} from '@/services/licensing.service'
import { getBusiness } from '@services/business.service'
import { formatCurrency } from '@utils/decimal'
import { formatDate } from '@utils/date'
import { GST_STATES } from '@utils/gst-states'
import type { BusinessWithOwner } from '@/types/user'

const INITIAL_FORM: CreateBusinessProfileInput = {
  businessName: '',
  ownerName: '',
  loginId: '',
  password: 'client123',
  invoicePrefix: 'INV',
  phone: '',
  email: '',
  gstin: '',
  pan: '',
  address: '',
  city: '',
  state: '',
  stateCode: '',
  pin: '',
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'licensing' | 'businesses'>('licensing')

  // Businesses State
  const [businesses, setBusinesses] = useState<BusinessWithOwner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Product Keys State
  const [productKeys, setProductKeys] = useState<ProductKeyRecord[]>([])
  const [isLoadingKeys, setIsLoadingKeys] = useState(true)
  const [keySearch, setKeySearch] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  const [keyForm, setKeyForm] = useState({
    clientName: '',
    contactInfo: '',
    plan: 'lifetime' as LicensePlan,
    edition: 'pro' as LicenseEdition,
    deviceId: '',
    notes: '',
  })
  const [generatedKeyResult, setGeneratedKeyResult] = useState<ProductKeyRecord | null>(null)

  // Create Business Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState<CreateBusinessProfileInput>(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdResult, setCreatedResult] = useState<{
    businessName: string
    loginId: string
    plainPassword: string
  } | null>(null)

  // Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<{ id: string; name: string; loginId: string } | null>(null)
  const [newPassword, setNewPassword] = useState('client123')
  const [isResetting, setIsResetting] = useState(false)

  // Admin Settings Modal State
  const { user, clearSession, startImpersonating } = useAuthStore()
  const [showAdminSettings, setShowAdminSettings] = useState(false)
  const [adminLoginId, setAdminLoginId] = useState(user?.email || 'admin')
  const [adminNewPassword, setAdminNewPassword] = useState('')
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false)

  // Clipboard copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const { success, error } = useNotificationStore()
  const navigate = useNavigate()

  async function loadData() {
    setIsLoading(true)
    try {
      const list = await listAllBusinessesWithOwners()
      setBusinesses(list)
    } catch (err: unknown) {
      console.error('[AdminDashboard] Load error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      error('Failed to load businesses', msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadKeys() {
    setIsLoadingKeys(true)
    try {
      const keys = await listAllProductKeys()
      setProductKeys(keys)
    } catch (err: unknown) {
      console.error('[AdminDashboard] Load keys error:', err)
    } finally {
      setIsLoadingKeys(false)
    }
  }

  useEffect(() => {
    loadData()
    loadKeys()
  }, [])

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return pwd
  }

  function copyToClipboard(text: string, key: string, label = 'Copied to clipboard') {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    success('Copied', label)
    setTimeout(() => setCopiedKey(null), 3000)
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault()
    if (!form.businessName.trim() || !form.ownerName.trim() || !form.loginId.trim() || !form.password.trim()) {
      error('Validation error', 'Please fill in Business Name, Owner Name, Login ID, and Password.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createBusinessWithOwner(form)
      setCreatedResult({
        businessName: result.business.name,
        loginId: form.loginId,
        plainPassword: form.password,
      })
      success('Business Created!', `Profile created for ${result.business.name}`)
      loadData()
      setForm(INITIAL_FORM)
    } catch (err: unknown) {
      console.error('[AdminDashboard] Create error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      error('Failed to create business', msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword() {
    if (!resetModalUser || !newPassword.trim()) return
    setIsResetting(true)
    try {
      await resetOwnerPassword(resetModalUser.id, newPassword)
      success('Password Reset', `Password updated for ${resetModalUser.loginId}`)
      copyToClipboard(
        `ORION Login Credentials:\nLogin ID: ${resetModalUser.loginId}\nNew Password: ${newPassword}`,
        `reset_${resetModalUser.id}`,
        'New credentials copied to clipboard'
      )
      setResetModalUser(null)
      setNewPassword('client123')
    } catch (err: unknown) {
      console.error('[AdminDashboard] Reset password error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      error('Failed to reset password', msg)
    } finally {
      setIsResetting(false)
    }
  }

  async function handleToggleStatus(biz: BusinessWithOwner) {
    if (!biz.userId) return
    const newStatus = !biz.userActive
    try {
      await toggleUserStatus(biz.userId, newStatus)
      success(
        newStatus ? 'Account Activated' : 'Account Deactivated',
        `User ${biz.ownerLoginId} is now ${newStatus ? 'active' : 'inactive'}`
      )
      setBusinesses((prev) =>
        prev.map((b) => (b.id === biz.id ? { ...b, userActive: newStatus } : b))
      )
    } catch (err: unknown) {
      console.error('[AdminDashboard] Toggle status error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      error('Status update failed', msg)
    }
  }

  async function handleEnterBusiness(bizId: string) {
    try {
      const targetBiz = await getBusiness(bizId)
      if (!targetBiz) {
        error('Business not found', 'Could not load business details')
        return
      }
      startImpersonating(targetBiz)
      success('Switching Profile', `Now managing billing for ${targetBiz.name}`)
      navigate('/dashboard')
    } catch (err: unknown) {
      console.error('[AdminDashboard] Switch error:', err)
      error('Failed to open billing', String(err))
    }
  }

  async function handleUpdateAdminCredentials() {
    if (!user || !adminLoginId.trim()) return
    setIsUpdatingAdmin(true)
    try {
      await updateAdminCredentials(user.id, adminLoginId.trim(), adminNewPassword.trim() || undefined)
      success('Admin Credentials Saved', `Login ID: ${adminLoginId.trim()} saved successfully!`)
      setShowAdminSettings(false)
      setAdminNewPassword('')
    } catch (err: unknown) {
      console.error('[AdminDashboard] Admin password update error:', err)
      error('Failed to update admin credentials', String(err))
    } finally {
      setIsUpdatingAdmin(false)
    }
  }

  async function handleGenerateKey(e: React.FormEvent) {
    e.preventDefault()
    if (!keyForm.clientName.trim()) {
      error('Validation Error', 'Client Business Name is required to generate a key.')
      return
    }

    setIsGeneratingKey(true)
    try {
      const record = await generateProductKey({
        clientName: keyForm.clientName.trim(),
        contactInfo: keyForm.contactInfo.trim() || undefined,
        plan: keyForm.plan,
        edition: keyForm.edition,
        deviceId: keyForm.deviceId.trim() || undefined,
        notes: keyForm.notes.trim() || undefined,
      })
      setGeneratedKeyResult(record)
      success('Product Key Generated', `Key created for ${record.clientName}`)
      loadKeys()
    } catch (err: unknown) {
      console.error('[AdminDashboard] Key generate error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      error('Failed to generate key', msg)
    } finally {
      setIsGeneratingKey(false)
    }
  }

  async function handleDeleteKey(id: string, clientName: string) {
    if (confirm(`Are you sure you want to delete/revoke the Product Key for "${clientName}"?`)) {
      try {
        await deleteProductKey(id)
        success('Key Removed', `Product key for ${clientName} deleted.`)
        loadKeys()
      } catch (err: unknown) {
        error('Failed to delete key', String(err))
      }
    }
  }

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  // Filtered businesses
  const filteredBusinesses = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.ownerName && b.ownerName.toLowerCase().includes(search.toLowerCase())) ||
      (b.ownerLoginId && b.ownerLoginId.toLowerCase().includes(search.toLowerCase())) ||
      (b.phone && b.phone.includes(search))
  )

  // Filtered product keys
  const filteredKeys = productKeys.filter(
    (k) =>
      k.clientName.toLowerCase().includes(keySearch.toLowerCase()) ||
      k.productKey.toLowerCase().includes(keySearch.toLowerCase()) ||
      (k.contactInfo && k.contactInfo.toLowerCase().includes(keySearch.toLowerCase()))
  )

  const totalInvoices = businesses.reduce((acc, b) => acc + b.invoiceCount, 0)
  const totalRevenue = businesses.reduce((acc, b) => acc + b.totalRevenue, 0)
  const activeOwners = businesses.filter((b) => b.userActive).length

  const STATE_OPTIONS = GST_STATES.map((s) => ({ value: s.code, label: s.name }))

  return (
    <div className="min-h-screen bg-[#F2F2F2] flex flex-col">
      {/* Top Admin Bar */}
      <header className="bg-[#18191B] text-white border-b border-black/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shadow-md bg-white shrink-0">
            <img src="/logo.png" alt="ORION" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              ORION Administration Portal
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Master Vendor Admin
              </span>
            </h1>
            <p className="text-xs text-gray-400">Product Keys, Licensing & Client Accounts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-white/10"
            leftIcon={<Settings size={14} />}
            onClick={() => setShowAdminSettings(true)}
          >
            Admin Credentials
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            leftIcon={<LogOut size={14} />}
            onClick={handleLogout}
          >
            Log Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-300 pb-2">
          <button
            onClick={() => setActiveTab('licensing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              activeTab === 'licensing'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-200/70'
            }`}
          >
            <KeyRound size={16} />
            Product Key Generator & Licensing
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-black/20 text-white">
              {productKeys.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('businesses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              activeTab === 'businesses'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-200/70'
            }`}
          >
            <Building2 size={16} />
            Client Business Profiles
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-black/20 text-white">
              {businesses.length}
            </span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: PRODUCT KEYS & LICENSING                         */}
        {/* ======================================================== */}
        {activeTab === 'licensing' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <KeyRound size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Total Keys Issued</p>
                  <p className="text-2xl font-bold text-gray-900">{productKeys.length}</p>
                </div>
              </Card>

              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Lifetime Licenses</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {productKeys.filter((k) => k.plan === 'lifetime').length}
                  </p>
                </div>
              </Card>

              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Laptop size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Activated Devices</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {productKeys.filter((k) => k.isActivated).length}
                  </p>
                </div>
              </Card>

              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Pro & Enterprise</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {productKeys.filter((k) => k.edition === 'pro' || k.edition === 'enterprise').length}
                  </p>
                </div>
              </Card>
            </div>

            {/* Licensing Action Header */}
            <div className="bg-white rounded-xl shadow-orion border border-orion-border p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Product Keys & Client Licenses</h2>
                  <p className="text-xs text-gray-500">
                    Generate genuine Product Keys for your clients. Each key allows the client to activate ORION on their computer.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCw size={14} />}
                    onClick={loadKeys}
                    isLoading={isLoadingKeys}
                  >
                    Refresh
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() => {
                      setGeneratedKeyResult(null)
                      setKeyForm({
                        clientName: '',
                        contactInfo: '',
                        plan: 'lifetime',
                        edition: 'pro',
                        deviceId: '',
                        notes: '',
                      })
                      setShowKeyModal(true)
                    }}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    Generate Product Key
                  </Button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-3 pt-2 border-t border-orion-border">
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={keySearch}
                    onChange={(e) => setKeySearch(e.target.value)}
                    placeholder="Search by client name, key, or phone..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-orion-border rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <span className="text-xs text-gray-500">
                  Showing {filteredKeys.length} of {productKeys.length} keys
                </span>
              </div>

              {/* Table of Keys */}
              {isLoadingKeys ? (
                <LoadingState message="Loading license keys..." fullHeight />
              ) : filteredKeys.length === 0 ? (
                <div className="py-12 text-center">
                  <KeyRound size={36} className="mx-auto text-gray-300 mb-2" />
                  <h3 className="text-sm font-semibold text-gray-700">No Product Keys Found</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
                    {keySearch ? 'No keys matched your search query.' : 'Click "Generate Product Key" to issue a license for your first client.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-orion-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-orion-border text-xs text-gray-500 font-semibold uppercase">
                      <tr>
                        <th className="px-4 py-3">Client / Business</th>
                        <th className="px-4 py-3">Product Key</th>
                        <th className="px-4 py-3">Plan & Edition</th>
                        <th className="px-4 py-3">Device Lock</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Issued Date</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orion-border bg-white">
                      {filteredKeys.map((k) => {
                        const instructions = `====================================================
ORION — License Activation
====================================================
Client Business: ${k.clientName}
License Plan: ${k.plan.toUpperCase()} (${k.edition.toUpperCase()} Edition)
Product Key: ${k.productKey}

Activation Instructions:
1. Install ORION on your computer (macOS or Windows).
2. Launch the app and enter your Business Name: "${k.clientName}"
3. Enter your Product Key: ${k.productKey}
4. Create your own Login ID and password.
5. You're ready to start billing with ORION!
====================================================`

                        return (
                          <tr key={k.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-gray-900">{k.clientName}</div>
                              {k.contactInfo && (
                                <div className="text-xs text-gray-500 mt-0.5">{k.contactInfo}</div>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                  {k.productKey}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(k.productKey, `pk_${k.id}`, 'Product Key copied')}
                                  className="text-gray-400 hover:text-gray-700 p-1"
                                  title="Copy Product Key"
                                >
                                  {copiedKey === `pk_${k.id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                </button>
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 uppercase">
                                  {k.plan}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 uppercase">
                                  {k.edition}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-xs text-gray-500">
                              {k.deviceId ? (
                                <span className="font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded">
                                  {k.deviceId}
                                </span>
                              ) : (
                                <span className="text-gray-400">Universal (Any 1 PC)</span>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              {k.isActivated ? (
                                <Badge variant="primary">Activated</Badge>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                                  Issued (Pending)
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-xs text-gray-500">
                              {formatDate(k.createdAt)}
                            </td>

                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => copyToClipboard(instructions, `inst_${k.id}`, 'Full Client Activation details copied!')}
                                  className="px-2.5 py-1 text-xs rounded border border-orion-border bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 font-medium transition-colors"
                                  title="Copy WhatsApp/Email message for client"
                                >
                                  {copiedKey === `inst_${k.id}` ? (
                                    <>
                                      <Check size={12} className="text-green-600" /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} /> Copy Info
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => handleDeleteKey(k.id, k.clientName)}
                                  className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200"
                                  title="Revoke / Delete Key"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CLIENT BUSINESSES & PROFILES                      */}
        {/* ======================================================== */}
        {activeTab === 'businesses' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Total Businesses</p>
                  <p className="text-2xl font-bold text-gray-900">{businesses.length}</p>
                </div>
              </Card>

              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <UserCheck size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Active Owners</p>
                  <p className="text-2xl font-bold text-gray-900">{activeOwners}</p>
                </div>
              </Card>

              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Invoices Generated</p>
                  <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
                </div>
              </Card>

              <Card className="flex items-center gap-4 p-4 border border-orion-border">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <IndianRupee size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Total System Billing</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                </div>
              </Card>
            </div>

            {/* Action Header & Search */}
            <div className="bg-white rounded-xl shadow-orion border border-orion-border p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Client Business Profiles</h2>
                  <p className="text-xs text-gray-500">
                    Manage business profiles and owner accounts on this device.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCw size={14} />}
                    onClick={loadData}
                    isLoading={isLoading}
                  >
                    Refresh
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() => {
                      setForm(INITIAL_FORM)
                      setCreatedResult(null)
                      setShowCreateModal(true)
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Create Business Profile
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-orion-border">
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by business, owner name, login ID..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-orion-border rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-xs text-gray-500">
                  Showing {filteredBusinesses.length} of {businesses.length} businesses
                </span>
              </div>

              {/* Directory Table */}
              {isLoading ? (
                <LoadingState message="Loading business profiles..." fullHeight />
              ) : filteredBusinesses.length === 0 ? (
                <div className="py-12 text-center">
                  <Building2 size={36} className="mx-auto text-gray-300 mb-2" />
                  <h3 className="text-sm font-semibold text-gray-700">No Business Profiles Found</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
                    {search ? 'No businesses matched your search query.' : 'Click "Create Business Profile" to add your first business owner.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-orion-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-orion-border text-xs text-gray-500 font-semibold uppercase">
                      <tr>
                        <th className="px-4 py-3">Business Profile</th>
                        <th className="px-4 py-3">Owner & Login ID</th>
                        <th className="px-4 py-3">Invoices & Billing</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orion-border bg-white">
                      {filteredBusinesses.map((biz) => {
                        const credentialsText = `ORION Billing Credentials:\nBusiness: ${biz.name}\nLogin ID: ${biz.ownerLoginId || 'Not set'}\nAccess: ORION Desktop App`

                        return (
                          <tr key={biz.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-gray-900">{biz.name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                <span className="font-mono bg-gray-100 px-1 rounded text-[11px]">Prefix: {biz.invoicePrefix}</span>
                                {biz.gstin && <span>GSTIN: {biz.gstin}</span>}
                                {biz.city && <span>· {biz.city}</span>}
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="font-medium text-gray-900">{biz.ownerName || '—'}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                  ID: {biz.ownerLoginId || 'None'}
                                </span>
                                {biz.ownerLoginId && (
                                  <button
                                    onClick={() => copyToClipboard(biz.ownerLoginId!, `id_${biz.id}`, 'Login ID copied')}
                                    className="text-gray-400 hover:text-gray-700 p-0.5"
                                    title="Copy Login ID"
                                  >
                                    {copiedKey === `id_${biz.id}` ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="font-medium text-gray-900 tabular-nums">{formatCurrency(biz.totalRevenue)}</div>
                              <div className="text-xs text-gray-500">{biz.invoiceCount} invoices</div>
                            </td>

                            <td className="px-4 py-3.5">
                              {biz.userActive ? (
                                <Badge variant="primary">Active</Badge>
                              ) : (
                                <Badge variant="danger">Deactivated</Badge>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-xs text-gray-500">
                              {formatDate(biz.createdAt)}
                            </td>

                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Open Billing */}
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="text-xs bg-indigo-600 hover:bg-indigo-700"
                                  leftIcon={<ExternalLink size={12} />}
                                  onClick={() => handleEnterBusiness(biz.id)}
                                >
                                  Open Billing
                                </Button>

                                {/* Copy Credentials Button */}
                                <button
                                  onClick={() => copyToClipboard(credentialsText, `cred_${biz.id}`, 'Credentials copied')}
                                  className="px-2.5 py-1 text-xs rounded border border-orion-border bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 font-medium transition-colors"
                                  title="Copy Login ID for client"
                                >
                                  {copiedKey === `cred_${biz.id}` ? (
                                    <>
                                      <Check size={12} className="text-green-600" /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} /> Copy ID
                                    </>
                                  )}
                                </button>

                                {/* Reset Password Button */}
                                {biz.userId && (
                                  <button
                                    onClick={() => {
                                      setResetModalUser({
                                        id: biz.userId!,
                                        name: biz.ownerName || biz.name,
                                        loginId: biz.ownerLoginId || biz.name,
                                      })
                                      setNewPassword('client123')
                                    }}
                                    className="px-2.5 py-1 text-xs rounded border border-orion-border bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 font-medium transition-colors"
                                    title="Set password for this owner"
                                  >
                                    <KeyRound size={12} /> Password
                                  </button>
                                )}

                                {/* Toggle Active Status */}
                                {biz.userId && (
                                  <button
                                    onClick={() => handleToggleStatus(biz)}
                                    className={`p-1.5 rounded border ${
                                      biz.userActive
                                        ? 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200'
                                        : 'border-green-200 text-green-600 hover:bg-green-50'
                                    }`}
                                    title={biz.userActive ? 'Deactivate account' : 'Activate account'}
                                  >
                                    {biz.userActive ? <UserX size={13} /> : <UserCheck size={13} />}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* GENERATE PRODUCT KEY MODAL                               */}
      {/* ======================================================== */}
      <Modal
        isOpen={showKeyModal}
        onClose={() => {
          if (!isGeneratingKey) {
            setShowKeyModal(false)
            setGeneratedKeyResult(null)
          }
        }}
        title="Generate Client Product Key"
        size="md"
      >
        {generatedKeyResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <CheckCircle2 size={36} className="text-emerald-600 mx-auto mb-2" />
              <h3 className="text-base font-bold text-gray-900">Product Key Issued Successfully!</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Copy and send these details to your client.
              </p>

              <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-300 font-mono text-sm font-bold text-amber-900 select-all">
                {generatedKeyResult.productKey}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
              <div>Client: <strong>{generatedKeyResult.clientName}</strong></div>
              <div>Plan: <strong className="uppercase">{generatedKeyResult.plan}</strong></div>
              <div>Edition: <strong className="uppercase">{generatedKeyResult.edition}</strong></div>
              <div>Device Lock: <strong>{generatedKeyResult.deviceId || 'Universal (Any 1 PC)'}</strong></div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  const instructions = `====================================================
ORION — License Activation
====================================================
Client Business: ${generatedKeyResult.clientName}
License Plan: ${generatedKeyResult.plan.toUpperCase()} (${generatedKeyResult.edition.toUpperCase()} Edition)
Product Key: ${generatedKeyResult.productKey}

Activation Instructions:
1. Install ORION on your computer (macOS or Windows).
2. Launch the app and enter your Business Name: "${generatedKeyResult.clientName}"
3. Enter your Product Key: ${generatedKeyResult.productKey}
4. Create your own Login ID and password.
5. Start using ORION!
====================================================`
                  copyToClipboard(instructions, 'modal_key_copy', 'Full instructions copied to clipboard!')
                }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Copy Full Details for Client
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowKeyModal(false)
                  setGeneratedKeyResult(null)
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateKey} className="space-y-4">
            <Input
              label="Client Business Name"
              required
              value={keyForm.clientName}
              onChange={(e) => setKeyForm({ ...keyForm, clientName: e.target.value })}
              placeholder="e.g. Balaji Garments or Sharma Textiles"
              hint="Must be entered exactly by client when activating"
              autoFocus
            />

            <Input
              label="Client Contact (Phone or Email)"
              value={keyForm.contactInfo}
              onChange={(e) => setKeyForm({ ...keyForm, contactInfo: e.target.value })}
              placeholder="+91 98765 43210"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">License Plan</label>
                <select
                  value={keyForm.plan}
                  onChange={(e) => setKeyForm({ ...keyForm, plan: e.target.value as LicensePlan })}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-orion-border rounded outline-none"
                >
                  <option value="lifetime">Lifetime License</option>
                  <option value="1year">1 Year Annual</option>
                  <option value="3year">3 Years License</option>
                  <option value="trial">30-Day Trial</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Software Edition</label>
                <select
                  value={keyForm.edition}
                  onChange={(e) => setKeyForm({ ...keyForm, edition: e.target.value as LicenseEdition })}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-orion-border rounded outline-none"
                >
                  <option value="pro">Professional</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
            </div>

            <Input
              label="Specific Hardware / Device ID (Optional)"
              value={keyForm.deviceId}
              onChange={(e) => setKeyForm({ ...keyForm, deviceId: e.target.value })}
              placeholder="e.g. DEV-MAC-8A2F-9C14"
              hint="Leave empty to allow activation on any 1 computer"
            />

            <div className="pt-3 border-t border-orion-border flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowKeyModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isGeneratingKey} className="bg-amber-600 hover:bg-amber-700">
                Generate Key
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* CREATE BUSINESS MODAL                                    */}
      {/* ======================================================== */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (!isSubmitting) {
            setShowCreateModal(false)
            setCreatedResult(null)
          }
        }}
        title="Create Business Profile & Owner Account"
        size="lg"
      >
        {createdResult ? (
          <div className="p-4 space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="text-sm font-bold text-green-900 mb-1">Business Profile Created!</h4>
              <p className="text-xs text-green-700">
                The business and owner login credentials have been saved.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-orion-border text-xs space-y-2">
              <div>Business: <strong>{createdResult.businessName}</strong></div>
              <div>Login ID: <strong className="font-mono text-indigo-700">{createdResult.loginId}</strong></div>
              <div>Password: <strong className="font-mono text-gray-900">{createdResult.plainPassword}</strong></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  const shareMsg = `ORION Billing Credentials:\nBusiness: ${createdResult.businessName}\nLogin ID: ${createdResult.loginId}\nPassword: ${createdResult.plainPassword}`
                  copyToClipboard(shareMsg, 'new_created', 'Login ID & Password copied!')
                }}
              >
                Copy ID & Password for Owner
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false)
                  setCreatedResult(null)
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateBusiness} className="space-y-5">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">1. Business Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    label="Business Name"
                    required
                    value={form.businessName}
                    onChange={(e) => {
                      const name = e.target.value
                      setForm((f) => ({
                        ...f,
                        businessName: name,
                        loginId: f.loginId === 'client123' || !f.loginId ? name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'owner' : f.loginId,
                      }))
                    }}
                    placeholder="e.g. Ramesh Traders"
                  />
                </div>
                <Input
                  label="Invoice Prefix"
                  value={form.invoicePrefix}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                  hint="e.g. RT, INV, SHM"
                />
                <Input
                  label="GSTIN (Optional)"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5"
                />
                <Input
                  label="Phone Number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                />
                <Input
                  label="Business Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="owner@domain.com"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-orion-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  2. Owner Login Credentials
                </h4>
                <span className="text-[11px] text-gray-400">Owner will use this to sign into billing</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    label="Owner Full Name"
                    required
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    placeholder="e.g. Ramesh Sharma"
                  />
                </div>

                <div>
                  <Input
                    label="Login ID (Username)"
                    required
                    value={form.loginId}
                    onChange={(e) => setForm({ ...form, loginId: e.target.value.trim().toLowerCase() })}
                    placeholder="e.g. ramesh or owner"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, password: generateRandomPassword() })}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <Sparkles size={11} /> Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Password for client"
                    className="w-full px-3 py-1.5 text-sm font-mono border border-orion-border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orion-primary outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-orion-border flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Create Profile & Save Credentials
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* RESET PASSWORD MODAL                                    */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!resetModalUser}
        onClose={() => {
          if (!isResetting) setResetModalUser(null)
        }}
        title={`Set Password for ${resetModalUser?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Login ID: <strong className="font-mono text-indigo-700">{resetModalUser?.loginId}</strong>
          </p>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-gray-700">Password</label>
              <button
                type="button"
                onClick={() => setNewPassword(generateRandomPassword())}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Sparkles size={12} /> Auto-generate
              </button>
            </div>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-orion-border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orion-primary outline-none"
              placeholder="Enter new password"
            />
          </div>

          <div className="pt-3 border-t border-orion-border flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleResetPassword}
              isLoading={isResetting}
              disabled={!newPassword.trim()}
            >
              Update Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* ADMIN SETTINGS MODAL                                     */}
      {/* ======================================================== */}
      <Modal
        isOpen={showAdminSettings}
        onClose={() => {
          if (!isUpdatingAdmin) setShowAdminSettings(false)
        }}
        title="Master Admin Permanent Credentials"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Set your permanent Master Admin Login ID and Password. These credentials will never change or reset.
          </p>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Admin Login ID</label>
            <input
              type="text"
              value={adminLoginId}
              onChange={(e) => setAdminLoginId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-orion-border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder="e.g. admin"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">New Admin Password (Optional)</label>
            <input
              type="password"
              value={adminNewPassword}
              onChange={(e) => setAdminNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-orion-border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder="Leave blank to keep existing password"
            />
          </div>

          <div className="pt-3 border-t border-orion-border flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAdminSettings(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateAdminCredentials}
              isLoading={isUpdatingAdmin}
              disabled={!adminLoginId.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Save Admin Credentials
            </Button>
          </div>
        </div>
      </Modal>

      {/* Admin Portal Status Footer */}
      <footer className="h-9 bg-white border-t border-gray-200 px-6 flex items-center justify-between text-xs text-gray-500 mt-auto flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="ORION" className="w-4 h-4 rounded object-cover shadow-2xs" />
          <span className="font-semibold text-gray-800">ORION</span>
          <span className="text-gray-300">|</span>
          <span>&copy; 2026 ORION INC. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>Master Administration Control Plane</span>
          <span>&bull;</span>
          <span className="font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
            v1.2 Pro
          </span>
        </div>
      </footer>
    </div>
  )
}
