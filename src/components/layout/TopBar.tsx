import { useNavigate } from 'react-router-dom'
import { Search, HelpCircle, LogOut, ArrowLeft, ShieldCheck, User } from 'lucide-react'
import { useUIStore } from '@store/ui.store'
import { useAuthStore } from '@store/auth.store'
import { QuickCreate } from './QuickCreate'

export function TopBar({ businessName }: { businessName: string }) {
  const { setGlobalSearchOpen, setShortcutsModalOpen } = useUIStore()
  const { user, isImpersonating, stopImpersonating, clearSession } = useAuthStore()
  const navigate = useNavigate()

  function handleReturnToAdmin() {
    stopImpersonating()
    navigate('/admin')
  }

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  return (
    <>
      {isImpersonating && (
        <div className="bg-amber-500 text-black px-4 py-1.5 flex items-center justify-between text-xs font-medium shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-black/10 px-1.5 py-0.5 rounded font-bold uppercase text-[10px] tracking-wider">
              Admin Mode
            </span>
            <span>You are currently managing billing for: <strong>{businessName}</strong></span>
          </div>
          <button
            onClick={handleReturnToAdmin}
            className="flex items-center gap-1 bg-black text-white px-2.5 py-1 rounded text-xs font-semibold hover:bg-black/80 transition-colors"
          >
            <ArrowLeft size={12} /> Return to Admin Portal
          </button>
        </div>
      )}

      <header className="h-14 flex items-center gap-3 px-5 bg-white border-b border-orion-border flex-shrink-0 select-none">
        <QuickCreate />

        <button
          onClick={() => setGlobalSearchOpen(true)}
          className="flex items-center justify-between h-8 px-3 rounded-lg border border-gray-200 bg-gray-50/80 text-xs text-gray-500 hover:bg-gray-100/80 hover:border-gray-300 hover:text-gray-800 transition-all w-60 shadow-2xs"
          title="Global Search (⌘K)"
        >
          <div className="flex items-center gap-2">
            <Search size={13} className="text-gray-400" />
            <span>Search anything...</span>
          </div>
          <kbd className="text-[10px] bg-white border border-gray-200 text-gray-400 rounded px-1.5 py-0.5 font-mono shadow-2xs">
            ⌘K
          </kbd>
        </button>

        <div className="flex-1" />


        <button
          onClick={() => setShortcutsModalOpen(true)}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-2xs"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle size={14} className="text-gray-400" />
          <span className="hidden md:inline font-medium text-[11px]">Shortcuts</span>
        </button>

        <div className="h-5 w-px bg-orion-border" />

        {/* Business & User Profile */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200/80 bg-white shadow-2xs flex-shrink-0">
            <img
              src="/logo.png"
              alt="ORION"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col text-left leading-tight hidden sm:flex">
            <span className="font-semibold text-gray-900 text-xs truncate max-w-[140px]">
              {businessName}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              {user?.role === 'admin' ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                  <ShieldCheck size={10} /> Admin
                </span>
              ) : (
                <span className="truncate max-w-[120px]">{user?.name || 'Owner'}</span>
              )}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 h-8 px-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
          title="Sign Out"
        >
          <LogOut size={15} />
        </button>
      </header>
    </>
  )
}
