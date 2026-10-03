import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { save, open } from '@tauri-apps/plugin-dialog'
import {
  Building,
  Sparkles,
  FileText,
  CreditCard,
  Settings as SettingsIcon,
  Download,
  Upload,
  HardDrive,
  Cloud,
  CheckCircle2,
  RefreshCw,
  FolderDown,
  FolderUp,
  Laptop,
  Monitor,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Database,
  Lock,
  Copy,
} from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { Card } from '@components/ui/Card'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { useNotificationStore } from '@store/notification.store'
import { useUIStore } from '@store/ui.store'
import { useBusinessStore } from '@store/business.store'
import { formatDate } from '@utils/date'
import { dbExecute, closeDb } from '@db/client'
import {
  getCloudBackupConfig,
  saveCloudBackupConfig,
  uploadBackupToCloud,
  listCloudBackups,
} from '@/services/cloud-backup.service'
import type { CloudBackupConfig } from '@/types/backup'

interface BackupInfo {
  file_name: string
  file_path: string
  file_size: number
  created_at: string
  checksum: string
}

export default function BackupSettings() {
  const navigate = useNavigate()
  const { success, error } = useNotificationStore()
  const { openConfirm } = useUIStore()
  const { business } = useBusinessStore()

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Cloud Backup State
  const [showCloudSettings, setShowCloudSettings] = useState(false)
  const [isSavingCloud, setIsSavingCloud] = useState(false)
  const [isUploadingCloud, setIsUploadingCloud] = useState(false)
  const [isLoadingCloud, setIsLoadingCloud] = useState(false)
  const [cloudBackups, setCloudBackups] = useState<Array<{ key: string; lastModified?: Date; size?: number }>>([])
  const [cloudConfig, setCloudConfig] = useState<CloudBackupConfig>({
    enabled: false,
    endpoint: '',
    bucket: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: '',
    prefix: 'backups',
  })

  // Cross-Platform Guide expansion
  const [isGuideOpen, setIsGuideOpen] = useState(true)

  async function loadBackups() {
    try {
      const list = await invoke<BackupInfo[]>('list_local_backups')
      setBackups(list)
    } catch (err) {
      console.error('Failed to list backups:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadCloudConfig() {
    try {
      const cfg = await getCloudBackupConfig()
      if (cfg) {
        setCloudConfig(cfg)
        if (cfg.enabled && cfg.bucket && cfg.accessKeyId) {
          loadCloudBackupsList()
        }
      }
    } catch (err) {
      console.error('Failed to load cloud config:', err)
    }
  }

  async function loadCloudBackupsList() {
    setIsLoadingCloud(true)
    try {
      const list = await listCloudBackups()
      setCloudBackups(list)
    } catch (err) {
      console.warn('Could not list cloud backups:', err)
    } finally {
      setIsLoadingCloud(false)
    }
  }

  useEffect(() => {
    loadBackups()
    loadCloudConfig()
  }, [])

  /** Create an instant local snapshot inside ORION's backup repository */
  async function handleQuickBackup() {
    setIsBackingUp(true)
    try {
      await dbExecute('PRAGMA wal_checkpoint(TRUNCATE)')
      await invoke('create_local_backup', { options: {} })
      success('Local backup snapshot created successfully')
      loadBackups()
    } catch (err) {
      error('Backup failed', err instanceof Error ? err.message : String(err))
    } finally {
      setIsBackingUp(false)
    }
  }

  /** Export backup to an arbitrary destination (USB Drive, Desktop, Google Drive, OneDrive) */
  async function handleExportToFile() {
    setIsExporting(true)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const defaultFileName = `ORION_Backup_${timestamp}.db`

      const filePath = await save({
        title: 'Export ORION Backup (USB, External Drive, or Cloud Folder)',
        defaultPath: defaultFileName,
        filters: [{ name: 'ORION Database Backup', extensions: ['db', 'sqlite'] }],
      })

      if (!filePath) {
        setIsExporting(false)
        return
      }

      // Flush WAL to ensure 100% of current transactions are written into main database file
      await dbExecute('PRAGMA wal_checkpoint(TRUNCATE)')

      await invoke('create_local_backup', {
        options: {
          destination_path: filePath,
        },
      })

      success('Backup exported successfully', `Saved to: ${filePath}`)
      loadBackups()
    } catch (err) {
      error('Export failed', err instanceof Error ? err.message : String(err))
    } finally {
      setIsExporting(false)
    }
  }

  /** Restore database from an external file picked by user (USB, Cloud Drive, etc.) */
  async function handleRestoreFromFile() {
    try {
      const selected = await open({
        title: 'Select ORION Backup File (.db) to Restore',
        multiple: false,
        directory: false,
        filters: [{ name: 'ORION Database Backup', extensions: ['db', 'sqlite'] }],
      })

      if (!selected || typeof selected !== 'string') return

      openConfirm({
        title: 'Restore Database from File',
        message: `Restoring will replace all active data with the selected file:\n\n${selected}\n\n• An automatic safety snapshot of your current database will be saved first.\n• The application will reload automatically upon completion.\n\nDo you want to proceed?`,
        variant: 'warning',
        confirmLabel: 'Restore & Reload',
        onConfirm: async () => {
          try {
            setIsRestoring(true)
            await closeDb()
            await invoke('restore_local_backup', { backupPath: selected })
            success('Database restored successfully! Reloading application...')
            setTimeout(() => {
              window.location.reload()
            }, 1200)
          } catch (err) {
            setIsRestoring(false)
            error('Restore failed', err instanceof Error ? err.message : String(err))
          }
        },
      })
    } catch (err) {
      error('File selection failed', err instanceof Error ? err.message : String(err))
    }
  }

  /** Restore an existing local snapshot from the list */
  function handleRestoreLocalBackup(b: BackupInfo) {
    openConfirm({
      title: 'Restore Local Backup Snapshot',
      message: `Restore snapshot "${b.file_name}" created on ${formatDate(b.created_at?.slice(0, 10))}?\n\n• Current data will be replaced by this snapshot.\n• A safety backup will be created automatically before overwriting.\n• The application will reload automatically.`,
      variant: 'warning',
      confirmLabel: 'Restore & Reload',
      onConfirm: async () => {
        try {
          setIsRestoring(true)
          await closeDb()
          await invoke('restore_local_backup', { backupPath: b.file_path })
          success('Database restored successfully! Reloading application...')
          setTimeout(() => {
            window.location.reload()
          }, 1200)
        } catch (err) {
          setIsRestoring(false)
          error('Restore failed', err instanceof Error ? err.message : String(err))
        }
      },
    })
  }

  /** Save a copy of an existing local snapshot to USB or folder */
  async function handleExportBackupCopy(b: BackupInfo) {
    try {
      const filePath = await save({
        title: `Save Copy of ${b.file_name}`,
        defaultPath: b.file_name,
        filters: [{ name: 'ORION Database Backup', extensions: ['db', 'sqlite'] }],
      })

      if (!filePath) return

      await invoke('create_local_backup', {
        options: {
          database_path: b.file_path,
          destination_path: filePath,
        },
      })

      success('Backup copy saved', `Saved to ${filePath}`)
    } catch (err) {
      error('Failed to save copy', err instanceof Error ? err.message : String(err))
    }
  }

  /** Save Cloud Backup Configuration */
  async function handleSaveCloudConfig() {
    setIsSavingCloud(true)
    try {
      await saveCloudBackupConfig(cloudConfig)
      success('Cloud backup settings saved')
      if (cloudConfig.enabled && cloudConfig.bucket && cloudConfig.accessKeyId) {
        loadCloudBackupsList()
      }
    } catch (err) {
      error('Failed to save cloud configuration', err instanceof Error ? err.message : String(err))
    } finally {
      setIsSavingCloud(false)
    }
  }

  /** Upload latest backup to S3 cloud storage */
  async function handleUploadToCloud() {
    setIsUploadingCloud(true)
    try {
      // 1. Flush WAL
      await dbExecute('PRAGMA wal_checkpoint(TRUNCATE)')
      // 2. Create local backup snapshot first
      const backupResult = await invoke<BackupInfo>('create_local_backup', { options: {} })
      // 3. Upload to cloud
      const businessId = business?.id || 'default'
      await uploadBackupToCloud(backupResult.file_path, backupResult.file_name, businessId)
      success('Uploaded to Cloud Storage', `Snapshot ${backupResult.file_name} uploaded.`)
      loadCloudBackupsList()
    } catch (err) {
      error('Cloud upload failed', err instanceof Error ? err.message : String(err))
    } finally {
      setIsUploadingCloud(false)
    }
  }

  function formatSize(bytes: number) {
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Backup & Restore"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              isLoading={isExporting}
              onClick={handleExportToFile}
              className="flex items-center gap-1.5"
            >
              <FolderUp size={15} />
              Export to File (USB / Drive)...
            </Button>
            <Button
              variant="secondary"
              size="sm"
              isLoading={isRestoring}
              onClick={handleRestoreFromFile}
              className="flex items-center gap-1.5"
            >
              <FolderDown size={15} />
              Restore from File...
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isBackingUp}
              onClick={handleQuickBackup}
              className="flex items-center gap-1.5"
            >
              <Database size={15} />
              Quick Backup
            </Button>
          </div>
        }
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold bg-gray-200 text-gray-900 transition-colors"
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

      {/* Cross-Platform Architecture & Compatibility Guide */}
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Cross-Platform Backup & Migration (macOS & Windows)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  100% Binary Compatible
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                ORION database backups (<code className="text-indigo-600 font-mono">.db</code>) are fully cross-compatible between Mac and Windows without any file conversion.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
            title={isGuideOpen ? 'Collapse Guide' : 'Expand Guide'}
          >
            {isGuideOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {isGuideOpen && (
          <div className="mt-4 pt-4 border-t border-indigo-100/80 space-y-4 text-xs">
            {/* Visual OS badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg border border-gray-200/80 shadow-xs flex items-start gap-3">
                <div className="p-2 rounded-md bg-gray-100 text-gray-800 shrink-0">
                  <Laptop size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-xs">macOS (Apple Silicon & Intel)</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Storage location: <span className="font-mono text-gray-700">~/Library/Application Support/com.orion.business/</span>
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium mt-1">
                    ✓ Cross-Platform Database Format
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-gray-200/80 shadow-xs flex items-start gap-3">
                <div className="p-2 rounded-md bg-sky-100 text-sky-800 shrink-0">
                  <Monitor size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-xs">Windows (10 / 11 64-bit & ARM)</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Storage location: <span className="font-mono text-gray-700">%APPDATA%\com.orion.business\</span>
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium mt-1">
                    ✓ Seamless Import & Export
                  </p>
                </div>
              </div>
            </div>

            {/* How to transfer between Mac and Windows */}
            <div className="p-3.5 bg-white/90 rounded-lg border border-indigo-100">
              <h4 className="font-semibold text-gray-900 text-xs flex items-center gap-1.5 mb-2.5">
                <HardDrive size={14} className="text-indigo-600" />
                How to Transfer Data Between Mac and Windows (Step-by-Step):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-2.5 rounded-md bg-gray-50 border border-gray-200/60">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800 text-[11px] mb-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                    Export on Source PC
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Click <strong>"Export to File..."</strong> above and save your <code className="font-mono text-indigo-700">.db</code> backup directly to a USB stick, external SSD, or cloud folder (Google Drive / OneDrive / Dropbox).
                  </p>
                </div>

                <div className="p-2.5 rounded-md bg-gray-50 border border-gray-200/60">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800 text-[11px] mb-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                    Open Destination PC
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Plug the USB into your other computer (or open the shared cloud folder), open ORION, and navigate to <strong>Settings &gt; Backup & Data</strong>.
                  </p>
                </div>

                <div className="p-2.5 rounded-md bg-gray-50 border border-gray-200/60">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800 text-[11px] mb-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                    Restore & Reload
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Click <strong>"Restore from File..."</strong>, select the <code className="font-mono text-indigo-700">.db</code> file. ORION will verify the file, create a safety snapshot, and reload in 1 click!
                  </p>
                </div>
              </div>
            </div>

            {/* Safety protections guarantee */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <ShieldCheck size={14} className="text-emerald-600" />
                Automatic Pre-Restore Safety Snapshot
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <CheckCircle2 size={14} className="text-indigo-600" />
                Transaction Integrity Check
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <Lock size={14} className="text-gray-500" />
                Database Integrity Verification
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Local Backups List */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-orion-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Local Snapshots</h3>
            <p className="text-xs text-orion-secondary mt-0.5">
              Point-in-time database snapshots stored locally in your app data repository.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadBackups}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        <div className="divide-y divide-orion-border">
          {backups.length === 0 && !isLoading && (
            <div className="text-center py-10 px-4">
              <Database size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">No backup snapshots found</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Click "Quick Backup" or "Export to File..." to create your first backup.
              </p>
            </div>
          )}

          {backups.map((b) => (
            <div key={b.file_name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-indigo-600 shrink-0" />
                  <p className="text-sm font-medium text-gray-900 truncate">{b.file_name}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-orion-secondary mt-1">
                  <span>{formatSize(b.file_size)}</span>
                  <span>•</span>
                  <span>{formatDate(b.created_at?.slice(0, 10))}</span>
                  {b.checksum && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-gray-400 truncate max-w-[120px]" title={`Checksum: ${b.checksum}`}>
                        ID: {b.checksum.slice(0, 8)}...
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportBackupCopy(b)}
                  className="text-xs flex items-center gap-1"
                  title="Save a copy of this backup to USB or custom folder"
                >
                  <Copy size={13} />
                  Save Copy As...
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleRestoreLocalBackup(b)}
                  isLoading={isRestoring}
                  className="text-xs flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white border-none"
                  title="Restore this snapshot (will reload app)"
                >
                  <RefreshCw size={13} />
                  Restore
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cloud Backup (S3 / Cloudflare R2 / MinIO) */}
      <Card padding={false}>
        <div
          className="px-5 py-4 border-b border-orion-border flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => setShowCloudSettings(!showCloudSettings)}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <Cloud size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Cloud Storage Sync (AWS S3 / Cloudflare R2)</h3>
                {cloudConfig.enabled ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-orion-secondary mt-0.5">
                Automatically backup and share database snapshots across macOS and Windows via S3-compatible cloud storage.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {showCloudSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>

        {showCloudSettings && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="cloud-enabled"
                checked={cloudConfig.enabled || false}
                onChange={(e) => setCloudConfig({ ...cloudConfig, enabled: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <label htmlFor="cloud-enabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                Enable S3-Compatible Cloud Backup
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <Input
                label="Endpoint URL (Optional for Cloudflare R2 / MinIO)"
                placeholder="https://<account-id>.r2.cloudflarestorage.com"
                value={cloudConfig.endpoint || ''}
                onChange={(e) => setCloudConfig({ ...cloudConfig, endpoint: e.target.value })}
                hint="Leave empty for official AWS S3"
              />

              <Input
                label="Bucket Name"
                placeholder="my-orion-backups"
                value={cloudConfig.bucket || ''}
                onChange={(e) => setCloudConfig({ ...cloudConfig, bucket: e.target.value })}
              />

              <Input
                label="Region"
                placeholder="us-east-1 (or auto for R2)"
                value={cloudConfig.region || 'us-east-1'}
                onChange={(e) => setCloudConfig({ ...cloudConfig, region: e.target.value })}
              />

              <Input
                label="Folder Prefix"
                placeholder="backups"
                value={cloudConfig.prefix || 'backups'}
                onChange={(e) => setCloudConfig({ ...cloudConfig, prefix: e.target.value })}
              />

              <Input
                label="Access Key ID"
                placeholder="AWS / R2 Access Key ID"
                value={cloudConfig.accessKeyId || ''}
                onChange={(e) => setCloudConfig({ ...cloudConfig, accessKeyId: e.target.value })}
              />

              <Input
                label="Secret Access Key"
                type="password"
                placeholder="AWS / R2 Secret Access Key"
                value={cloudConfig.secretAccessKey || ''}
                onChange={(e) => setCloudConfig({ ...cloudConfig, secretAccessKey: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-orion-border">
              <div className="text-[11px] text-gray-500">
                Credentials are saved encrypted locally on your machine.
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isSavingCloud}
                  onClick={handleSaveCloudConfig}
                >
                  Save Configuration
                </Button>
                {cloudConfig.enabled && (
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isUploadingCloud}
                    onClick={handleUploadToCloud}
                    className="flex items-center gap-1.5"
                  >
                    <Upload size={14} />
                    Upload Latest Backup Now
                  </Button>
                )}
              </div>
            </div>

            {/* Remote Cloud Backups List */}
            {cloudConfig.enabled && cloudBackups.length > 0 && (
              <div className="mt-4 pt-4 border-t border-orion-border">
                <h4 className="text-xs font-semibold text-gray-800 mb-2">Remote Cloud Backups ({cloudBackups.length})</h4>
                <div className="divide-y divide-gray-100 rounded-md border border-gray-200 overflow-hidden text-xs">
                  {cloudBackups.map((cb) => (
                    <div key={cb.key} className="px-3 py-2 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-2">
                        <Cloud size={14} className="text-sky-600 shrink-0" />
                        <span className="font-mono text-[11px] text-gray-800 truncate">{cb.key}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        {cb.size && <span>{formatSize(cb.size)}</span>}
                        {cb.lastModified && <span>{new Date(cb.lastModified).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
