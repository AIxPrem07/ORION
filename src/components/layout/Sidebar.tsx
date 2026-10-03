import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Truck,
  ShoppingCart,
  CreditCard,
  BookOpen,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  ShieldCheck,
  Landmark,
  type LucideIcon,
} from 'lucide-react'
import { useUIStore } from '@store/ui.store'
import { useAuthStore } from '@store/auth.store'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Sales & Billing',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Invoices', path: '/invoices', icon: FileText },
      { label: 'Purchases', path: '/purchases', icon: ShoppingCart },
      { label: 'Returns & Notes', path: '/returns', icon: RotateCcw },
    ],
  },
  {
    title: 'Stock & Parties',
    items: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Suppliers', path: '/suppliers', icon: Truck },
      { label: 'Products', path: '/products', icon: Package },
      { label: 'Inventory', path: '/inventory', icon: ClipboardList },
    ],
  },
  {
    title: 'Accounts & Tax',
    items: [
      { label: 'Payments', path: '/payments', icon: CreditCard },
      { label: 'Customer Ledger', path: '/ledger/customers', icon: BookOpen },
      { label: 'Reports', path: '/reports', icon: BarChart2 },
      { label: 'GST Returns', path: '/reports/gst-filing', icon: Landmark },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', path: '/settings/profile', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user } = useAuthStore()

  // Clone sections and append Admin Portal if user is admin
  const sections = NAV_SECTIONS.map((sec) => {
    if (sec.title === 'System' && user?.role === 'admin') {
      return {
        ...sec,
        items: [
          ...sec.items,
          { label: 'Admin Portal', path: '/admin', icon: ShieldCheck },
        ],
      }
    }
    return sec
  })

  return (
    <aside
      className={`flex-shrink-0 flex flex-col h-screen bg-white border-r border-orion-border select-none transition-all duration-200 ${
        sidebarCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Brand & Logo Header */}
      <div
        className={`flex items-center h-14 px-3.5 border-b border-orion-border bg-white ${
          sidebarCollapsed ? 'justify-center' : 'gap-2.5'
        }`}
      >
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-xs border border-gray-200/80 bg-white">
          <img
            src="/logo.png"
            alt="ORION"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback
              (e.target as HTMLElement).style.display = 'none'
            }}
          />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold tracking-tight text-gray-900 text-sm">ORION</span>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 py-2 overflow-y-auto px-2 space-y-3">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-0.5">
            {!sidebarCollapsed && section.title && (
              <div className="px-2 pt-1 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.title}
              </div>
            )}
            {section.items.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-900 text-white font-medium shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  } ${sidebarCollapsed ? 'justify-center px-0 py-2' : ''}`
                }
                title={sidebarCollapsed ? label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={15}
                      className={`flex-shrink-0 transition-colors ${
                        isActive ? 'text-emerald-400' : 'text-gray-500'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse / Expand Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-9 border-t border-orion-border text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xs"
        title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={15} /> : (
          <div className="flex items-center gap-1.5">
            <ChevronLeft size={15} />
            <span className="text-[11px] font-medium text-gray-500">Collapse</span>
          </div>
        )}
      </button>
    </aside>
  )
}
