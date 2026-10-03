import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  FileText,
  ShoppingCart,
  Users,
  Truck,
  Package,
  CreditCard,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'

export function QuickCreate() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (path: string) => {
    setIsOpen(false)
    navigate(path)
  }

  const items = [
    { label: 'New Invoice', path: '/invoices/new', icon: FileText, shortcut: '⌘N' },
    { label: 'New Purchase', path: '/purchases/new', icon: ShoppingCart },
    { label: 'New Customer', path: '/customers/new', icon: Users },
    { label: 'New Supplier', path: '/suppliers/new', icon: Truck },
    { label: 'New Product', path: '/products/new', icon: Package },
    { label: 'Record Payment', path: '/payments', icon: CreditCard },
    { label: 'New Return & Note', path: '/returns', icon: RotateCcw },
  ]

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded bg-orion-primary text-gray-900 text-xs font-medium hover:bg-[#d2e4d7] transition-colors border border-orion-border"
        title="Quick Create"
      >
        <Plus size={13} className="text-gray-800" />
        <span>New</span>
        <ChevronDown size={11} className="text-gray-600" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-52 bg-white rounded-md shadow-lg border border-orion-border py-1 z-50">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-orion-secondary">
            Quick Actions
          </div>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => handleSelect(item.path)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-orion-secondary" />
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-200 px-1 rounded">
                    {item.shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
