/**
 * ORION Offline Login Page
 * 
 * Supports:
 * - Brand-first Business Owner offline login (displays client's Brand Name)
 * - 100% Offline authentication against local SQLite
 * - Hidden, cryptographically protected Master Vendor Access (no visible admin links for clients)
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { useAuthStore } from '@store/auth.store'
import { useNotificationStore } from '@store/notification.store'
import { authenticateUser, unlockMasterAdminWithPasskey } from '@services/auth.service'
import { getBusiness } from '@services/business.service'
import { getActiveLicense, type ActiveLicenseInfo } from '@/services/licensing.service'
import type { Business } from '@/types/business'

export default function Login() {
  const [searchParams] = useSearchParams()
  const isAdminParam = searchParams.get('admin') === 'true'

  const [isAdminMode, setIsAdminMode] = useState(isAdminParam)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [businessProfile, setBusinessProfile] = useState<Business | null>(null)
  const [licenseInfo, setLicenseInfo] = useState<ActiveLicenseInfo | null>(null)

  // Hidden Master Vendor Access State
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [vendorPasskey, setVendorPasskey] = useState('')
  const [isUnlockingVendor, setIsUnlockingVendor] = useState(false)
  const [secretClickCount, setSecretClickCount] = useState(0)

  const { setSession } = useAuthStore()
  const { success, error } = useNotificationStore()
  const navigate = useNavigate()

  useEffect(() => {
    async function loadBrandData() {
      const biz = await getBusiness()
      if (biz) {
        setBusinessProfile(biz)
      }

      const lic = await getActiveLicense()
      setLicenseInfo(lic)

      if (!isAdminParam) {
        const lastId = localStorage.getItem('orion_last_login_id')
        if (lastId) {
          setLoginId(lastId)
        }
      } else {
        setLoginId('admin')
      }
    }

    loadBrandData()
  }, [isAdminParam])

  // Secret shortcut listener (Ctrl+Alt+Shift+A or Cmd+Alt+Shift+A)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setShowVendorModal(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSecretClick() {
    const nextCount = secretClickCount + 1
    if (nextCount >= 5) {
      setSecretClickCount(0)
      setShowVendorModal(true)
    } else {
      setSecretClickCount(nextCount)
    }
  }

  async function handleVendorUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!vendorPasskey.trim()) return

    setIsUnlockingVendor(true)
    try {
      const result = await unlockMasterAdminWithPasskey(vendorPasskey)
      if (!result.success || !result.user) {
        error('Access Denied', result.error || 'Invalid Master Vendor Passkey.')
        return
      }

      setSession(result.user)
      success('Master Access Granted', 'Logged in to Master Admin Portal')
      setShowVendorModal(false)
      navigate('/admin', { replace: true })
    } catch (err: unknown) {
      console.error('[Vendor Unlock] Error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      error('Access Denied', msg)
    } finally {
      setIsUnlockingVendor(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginId.trim() || !password) {
      error('Missing credentials', 'Please enter your Login ID and password')
      return
    }

    setIsLoading(true)
    try {
      const res = await authenticateUser(loginId, password)
      if (!res.success || !res.user) {
        error(
          'Login failed',
          `${res.error || 'Invalid Login ID or Password'}. If you haven't created your login credentials yet, click "Set Up Your Business Account" below.`,
        )
        return
      }

      if (res.user.role !== 'admin') {
        localStorage.setItem('orion_last_login_id', loginId.trim())
      }

      setSession(res.user, res.business)
      success('Welcome back', `Logged in as ${res.user.name}`)

      if (res.user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err: unknown) {
      console.error('[Login] Error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      error('Login error', msg)
    } finally {
      setIsLoading(false)
    }
  }

  const brandTitle = licenseInfo?.clientName || businessProfile?.name || 'ORION'

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-orion-lg border border-orion-border overflow-hidden">
        {/* Brand Header Banner */}
        <div className={`px-8 py-8 flex flex-col items-center text-center text-white relative transition-colors duration-300 ${
          isAdminMode ? 'bg-[#18191B]' : 'bg-gradient-to-b from-[#181B20] to-[#0F1216]'
        }`}>
          <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3.5 border-2 border-white/20 shadow-lg bg-white flex-shrink-0">
            <img src="/logo.png" alt="ORION" className="w-full h-full object-cover" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white line-clamp-1">
            {isAdminMode ? 'ORION Master Administration' : brandTitle}
          </h1>

          <p className="text-xs text-gray-300 mt-1">
            {isAdminMode ? 'Licensing & Client Accounts Control' : 'Billing & Inventory Management'}
          </p>

          {licenseInfo?.isActivated && !isAdminMode && (
            <div className="mt-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-gray-200 border border-white/15">
                License: {licenseInfo.plan?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900">
              {isAdminMode ? 'Master Admin Sign In' : 'Sign in to your brand'}
            </h2>
            <p className="text-xs text-gray-500">
              {isAdminMode
                ? 'Enter your Master Admin credentials to access administration.'
                : 'Enter your business User ID and password to access billing.'}
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div>
              <Input
                label="Login ID / Username"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder={isAdminMode ? 'admin' : 'e.g. owner or your username'}
                autoFocus
              />
            </div>

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            isLoading={isLoading}
            rightIcon={<ArrowRight size={16} />}
            className={`mt-6 ${isAdminMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {isAdminMode ? 'Access Admin Portal' : 'Sign In to Billing'}
          </Button>

          {/* Account Setup Link for Clients */}
          {!isAdminMode && (
            <div className="pt-3 border-t border-orion-border text-center">
              <p className="text-xs text-gray-500 mb-2">First time here or need to configure your account?</p>
              <button
                type="button"
                onClick={() => navigate('/setup')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Building2 size={13} />
                Set Up Your Business Account →
              </button>
            </div>
          )}

          {/* Bottom Activation helper if unactivated */}
          {!licenseInfo?.isActivated && (
            <div className="pt-3 border-t border-orion-border text-center text-xs">
              <button
                type="button"
                onClick={() => navigate('/activate')}
                className="text-indigo-600 hover:underline font-medium"
              >
                Enter Product Key to Activate Software
              </button>
            </div>
          )}

          {isAdminMode && (
            <div className="pt-3 border-t border-orion-border text-center text-xs">
              <button
                type="button"
                onClick={() => setIsAdminMode(false)}
                className="text-gray-500 hover:text-gray-800 font-medium"
              >
                ← Back to Business Login
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Discrete Footer with Secret Vendor Click Listener */}
      <div
        onClick={handleSecretClick}
        className="mt-6 text-center text-xs text-gray-400 cursor-default select-none transition-colors hover:text-gray-500"
      >
        <p className="font-medium text-gray-500">
          &copy; 2026 ORION INC. All rights reserved.
        </p>
      </div>

      {/* ======================================================== */}
      {/* SECRET MASTER VENDOR ACCESS MODAL                        */}
      {/* ======================================================== */}
      <Modal
        isOpen={showVendorModal}
        onClose={() => {
          if (!isUnlockingVendor) {
            setShowVendorModal(false)
            setVendorPasskey('')
          }
        }}
        title="Master Vendor Security Access"
        size="sm"
      >
        <form onSubmit={handleVendorUnlock} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
            <Lock size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Vendor Authorization Required:</strong> Enter your secret Master Vendor Passkey to access license and administration tools.
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Master Vendor Passkey
            </label>
            <input
              type="password"
              required
              autoFocus
              value={vendorPasskey}
              onChange={(e) => setVendorPasskey(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full px-3 py-2 text-sm font-mono border border-orion-border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowVendorModal(false)
                setVendorPasskey('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isUnlockingVendor}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Unlock Master Admin
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
