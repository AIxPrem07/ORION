import { useUIStore } from '@store/ui.store'

export function AppFooter() {
  const { setGlobalSearchOpen, setShortcutsModalOpen } = useUIStore()

  return (
    <footer className="h-7 bg-white border-t border-orion-border px-4 flex items-center justify-between text-[11px] text-gray-500 select-none flex-shrink-0 z-10">
      {/* Left: ORION Inc. Copyright & Brand */}
      <div className="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="ORION"
          className="w-3.5 h-3.5 rounded object-cover shadow-2xs"
          onError={(e) => {
            // Fallback if image path differs
            (e.target as HTMLElement).style.display = 'none'
          }}
        />
        <span className="font-semibold text-gray-700 tracking-tight">ORION</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500 hover:text-gray-700 transition-colors">
          &copy; 2026 ORION INC. All rights reserved.
        </span>
      </div>


      {/* Right: Quick Action Shortcuts & Build Version */}
      <div className="flex items-center gap-3 text-[10px]">
        <button
          onClick={() => setGlobalSearchOpen(true)}
          className="hidden sm:flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors px-1 py-0.5 rounded hover:bg-gray-100"
          title="Search anything (⌘K)"
        >
          <kbd className="px-1 py-0.2 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">⌘K</kbd>
          <span>Search</span>
        </button>

        <button
          onClick={() => setShortcutsModalOpen(true)}
          className="hidden sm:flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors px-1 py-0.5 rounded hover:bg-gray-100"
          title="Keyboard Shortcuts (?)"
        >
          <kbd className="px-1 py-0.2 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">?</kbd>
          <span>Shortcuts</span>
        </button>

        <span className="text-gray-300">•</span>

        <span className="font-mono text-gray-600 font-medium bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
          v1.5
        </span>
      </div>
    </footer>
  )
}
