import { Modal } from '@components/ui/Modal'
import { Keyboard } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { key: '⌘ / Ctrl + K', description: 'Open Global Search across invoices, customers & products' },
  { key: '⌘ / Ctrl + N', description: 'Quickly create a new Tax Invoice' },
  { key: '⌘ / Ctrl + B', description: 'Toggle navigation sidebar collapsed state' },
  { key: 'Esc', description: 'Close any active modal, dialog, or search overlay' },
  { key: '?', description: 'View this Keyboard Shortcuts cheat sheet' },
]

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-orion-secondary pb-2 border-b border-orion-border">
          <Keyboard size={16} />
          <span>Speed up your billing workflow with keyboard shortcuts</span>
        </div>

        <div className="divide-y divide-gray-100">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-gray-600">{s.description}</span>
              <kbd className="px-2 py-1 font-mono font-medium text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm text-[11px] whitespace-nowrap ml-3">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5 font-medium text-gray-500">
            <img src="/logo.png" alt="ORION" className="w-3.5 h-3.5 rounded object-cover" />
            &copy; 2026 ORION INC. All rights reserved.
          </span>
          <span className="font-mono text-gray-400">v1.5 Pro</span>
        </div>
      </div>
    </Modal>
  )
}
