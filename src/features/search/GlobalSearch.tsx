import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, FileText, Users, Package, Truck } from 'lucide-react'
import { useUIStore } from '@store/ui.store'
import { useBusinessStore } from '@store/business.store'
import { listCustomers } from '@services/customer.service'
import { listProducts } from '@services/product.service'
import { listInvoices } from '@services/invoice.service'

interface SearchResult { id: string; type: 'invoice' | 'customer' | 'product'; title: string; subtitle?: string; href: string }

export function GlobalSearch() {
  const { setGlobalSearchOpen } = useUIStore()
  const { business } = useBusinessStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim() || !business) { setResults([]); return }
    const timer = setTimeout(async () => {
      const [customers, products, invoices] = await Promise.all([
        listCustomers({ businessId: business.id, search: query, pageSize: 5 }),
        listProducts({ businessId: business.id, search: query, pageSize: 5 }),
        listInvoices({ businessId: business.id, search: query, pageSize: 5 }),
      ])
      setResults([
        ...customers.data.map((c) => ({ id: c.id, type: 'customer' as const, title: c.name, subtitle: c.phone ?? undefined, href: `/customers/${c.id}` })),
        ...products.data.map((p) => ({ id: p.id, type: 'product' as const, title: p.name, subtitle: p.productCode ?? undefined, href: `/products/${p.id}` })),
        ...invoices.data.map((inv) => ({ id: inv.id, type: 'invoice' as const, title: inv.invoiceNumber, subtitle: inv.customerSnapshot?.name, href: `/invoices/${inv.id}` })),
      ])
    }, 250)
    return () => clearTimeout(timer)
  }, [query, business])

  const ICONS = { invoice: FileText, customer: Users, product: Package }

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-start justify-center pt-24" onClick={(e) => { if (e.target === e.currentTarget) setGlobalSearchOpen(false) }}>
      <div className="bg-white rounded-lg shadow-orion-lg w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-orion-border">
          <Search size={16} className="text-orion-secondary flex-shrink-0" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoices, customers, products..." className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400" onKeyDown={(e) => { if (e.key === 'Escape') setGlobalSearchOpen(false) }} />
          <button onClick={() => setGlobalSearchOpen(false)} className="text-orion-secondary hover:text-gray-700"><X size={14} /></button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 && query && <p className="text-center text-xs text-orion-secondary py-8">No results for "{query}"</p>}
          {results.map((r) => {
            const Icon = ICONS[r.type]
            return (
              <button key={r.id} onClick={() => { setGlobalSearchOpen(false); navigate(r.href) }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-orion-border last:border-0">
                <Icon size={14} className="text-orion-secondary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-orion-secondary truncate">{r.subtitle}</p>}
                </div>
                <span className="ml-auto text-xs text-gray-400 capitalize flex-shrink-0">{r.type}</span>
              </button>
            )
          })}
        </div>

        {/* Global Search Footer */}
        <div className="px-4 py-2 bg-gray-50/90 border-t border-orion-border flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <img src="/logo.png" alt="ORION" className="w-3.5 h-3.5 rounded object-cover shadow-2xs" />
            <span className="font-semibold text-gray-700">ORION Search</span>
            <span className="text-gray-300">|</span>
            <span className="text-[10px] text-gray-400">&copy; 2026 ORION INC.</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
