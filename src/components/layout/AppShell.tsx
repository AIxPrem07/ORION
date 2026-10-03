import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useBusinessStore } from '@store/business.store'
import { useAuthStore } from '@store/auth.store'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AppFooter } from './AppFooter'
import LoadingState from '@components/ui/LoadingState'

import { getActiveLicense } from '@/services/licensing.service'

export default function AppShell() {
  const { business, isLoading, isSetupComplete } = useBusinessStore()
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    async function checkAuthAndLicense() {
      if (!isLoading) {
        if (!isAuthenticated) {
          const lic = await getActiveLicense()
          if (!lic.isActivated) {
            navigate('/activate', { replace: true })
          } else {
            navigate('/login', { replace: true })
          }
        } else if (!isSetupComplete && location.pathname !== '/setup' && user?.role !== 'admin') {
          navigate('/setup', { replace: true })
        }
      }
    }
    checkAuthAndLicense()
  }, [isLoading, isAuthenticated, isSetupComplete, navigate, location.pathname, user?.role])

  if (isLoading) return <LoadingState fullScreen message="Loading ORION..." />
  if (!isAuthenticated) return null
  if (!isSetupComplete && user?.role !== 'admin') return null

  return (
    <div className="flex h-screen bg-orion-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar businessName={business?.name ?? 'ORION'} />
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
