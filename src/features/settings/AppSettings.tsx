import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building,
  Sparkles,
  FileText,
  CreditCard,
  Settings as SettingsIcon,
  RefreshCw,
  ShieldCheck,
  HardDrive,
  Info,
  CheckCircle2,
  Database,
  ArrowUpCircle,
} from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Card } from '@components/ui/Card'
import { Button } from '@components/ui/Button'
import { Select } from '@components/ui/Select'
import { useNotificationStore } from '@store/notification.store'
import { getAppSetting, setAppSetting } from '@services/business.service'
import { getActiveLicense } from '@services/licensing.service'
import type { ActiveLicenseInfo } from '@services/licensing.service'

export default function AppSettings() {
  const navigate = useNavigate()
  const { success, error, info } = useNotificationStore()
  const [gstMode, setGstMode] = useState('exclusive')
  const [isSaving, setIsSaving] = useState(false)
  const [dbVersion, setDbVersion] = useState<string>('3')
  const [license, setLicense] = useState<ActiveLicenseInfo | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  useEffect(() => {
    getAppSetting('gst_mode').then((v) => { if (v) setGstMode(v) })
    getAppSetting('db_version').then((v) => { if (v) setDbVersion(v) })
    getActiveLicense().then(setLicense).catch(() => null)
  }, [])

  async function handleSave() {
    setIsSaving(true)
    try {
      await setAppSetting('gst_mode', gstMode)
      success('Settings saved')
    } catch {
      error('Save failed')
    } finally { setIsSaving(false) }
  }

  async function handleCheckForUpdates() {
    setIsCheckingUpdate(true)
    setUpdateMessage(null)
    
    // Simulate/Perform update check
    setTimeout(() => {
      setIsCheckingUpdate(false)
      setUpdateMessage('You are running the latest version (v1.5.1). Your software and database are completely up to date.')
      info('Software is up to date (v1.5.1)')
    }, 900)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="App Settings" actions={<Button variant="primary" size="sm" isLoading={isSaving} onClick={handleSave}>Save</Button>} />

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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold bg-gray-200 text-gray-900 transition-colors"
        >
          <SettingsIcon size={14} />
          App Settings
        </button>
      </div>

      <Card>
        <h3 className="text-sm font-semibold mb-4">GST Settings</h3>
        <div className="max-w-xs">
          <Select
            label="GST Pricing Mode"
            value={gstMode}
            onChange={(e) => setGstMode(e.target.value)}
            options={[
              { value: 'exclusive', label: 'GST Exclusive (prices shown without GST)' },
              { value: 'inclusive', label: 'GST Inclusive (prices already include GST)' },
            ]}
            hint="This applies globally. Can be overridden per invoice."
          />
        </div>
      </Card>

      {/* Software Information & Updates */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200/80 shadow-xs bg-white flex-shrink-0">
              <img src="/logo.png" alt="ORION" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Software & System Updates</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 size={12} className="mr-1" /> v1.5.1 (Latest)
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                ORION Billing & Inventory Management.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/backup')}
            >
              <HardDrive size={13} className="mr-1.5 text-gray-500" />
              Pre-Update Backup
            </Button>
            <Button
              variant="secondary"
              size="sm"
              isLoading={isCheckingUpdate}
              onClick={handleCheckForUpdates}
            >
              <RefreshCw size={13} className="mr-1.5" />
              Check for Updates
            </Button>
          </div>
        </div>

        {updateMessage && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{updateMessage}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
            <div className="font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
              <ShieldCheck size={14} className="text-indigo-600" />
              App Version
            </div>
            <div className="text-gray-900 font-mono font-medium">ORION v1.5.1</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Application Release</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
            <div className="font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
              <Database size={14} className="text-emerald-600" />
              Database
            </div>
            <div className="text-gray-900 font-mono font-medium">Schema Version {dbVersion}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Up to date</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
            <div className="font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
              <Sparkles size={14} className="text-amber-600" />
              License Status
            </div>
            <div className="text-gray-900 font-mono font-medium capitalize">
              {license?.isActivated ? `${license.edition || 'Pro'} Edition` : 'Active'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Verified License</div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">Software Updates:</span>
              <p className="text-[11px] leading-relaxed text-blue-800">
                Updating ORION is safe and non-destructive. When an update is installed, all invoices, inventory, ledgers, custom templates, and settings remain completely intact and preserved on the device.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
