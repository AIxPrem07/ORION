/**
 * ORION Application Root
 * Initializes the database, loads business profile, and renders the router.
 */
import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { initializeDatabase } from '@db/migrations'
import { getBusiness, isSetupComplete } from '@services/business.service'
import { seedMasterAdminIfMissing } from '@services/auth.service'
import { useBusinessStore } from '@store/business.store'
import { useAuthStore } from '@store/auth.store'
import { useNotificationStore } from '@store/notification.store'
import { ToastContainer } from '@components/ui/Toast'
import { GlobalSearch } from '@features/search/GlobalSearch'
import { useUIStore } from '@store/ui.store'
import { ConfirmDialog } from '@components/ui/ConfirmDialog'
import { KeyboardShortcutsModal } from '@components/shared/KeyboardShortcutsModal'

export default function App() {
  const [dbReady, setDbReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const { setBusiness, setLoading, setSetupComplete } = useBusinessStore()
  const { toasts } = useNotificationStore()
  const { globalSearchOpen, confirmModal, shortcutsModalOpen, setShortcutsModalOpen } = useUIStore()

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize SQLite database with migrations
        await initializeDatabase()

        // Ensure Master Admin exists
        await seedMasterAdminIfMissing()

        // Restore session from localStorage
        useAuthStore.getState().initFromStorage()
        const authState = useAuthStore.getState()

        // Load business and setup state
        const [business, setupDone] = await Promise.all([
          authState.business ? Promise.resolve(authState.business) : getBusiness(),
          isSetupComplete(),
        ])

        if (business) {
          setBusiness(business)
        }
        setSetupComplete(setupDone)
        setLoading(false)
        setDbReady(true)
      } catch (err) {
        console.error('[ORION] Database initialization failed:', err)
        const errMsg =
          err instanceof Error
            ? err.message
            : typeof err === 'object'
            ? JSON.stringify(err)
            : String(err)
        setInitError(errMsg)
      }
    }

    initialize()
  }, [])

  // Register global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUIStore.getState().setGlobalSearchOpen(true)
      } else if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        router.navigate('/invoices/new')
      } else if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        useUIStore.getState().toggleSidebar()
      } else if (!isInput && e.key === '?') {
        e.preventDefault()
        useUIStore.getState().setShortcutsModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen bg-orion-bg">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-orion text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Database Error</h1>
          <p className="text-gray-600 mb-4">{initError}</p>
          <p className="text-sm text-gray-400">
            Please restart ORION. If the problem persists, check the application logs.
          </p>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-orion-bg">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-700 mb-2">ORION</div>
          <div className="text-sm text-orion-secondary">Starting up...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer toasts={toasts} />
      {globalSearchOpen && <GlobalSearch />}
      {confirmModal && <ConfirmDialog {...confirmModal} />}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </>
  )
}
