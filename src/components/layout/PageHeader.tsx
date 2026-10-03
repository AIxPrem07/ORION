import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, actions, breadcrumb }: {
  title: string; subtitle?: string; actions?: ReactNode; breadcrumb?: Array<{ label: string }>
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        {breadcrumb && (
          <nav className="flex items-center gap-1 mb-1">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 text-xs">/</span>}
                <span className={`text-xs ${i === breadcrumb.length - 1 ? 'text-gray-700 font-medium' : 'text-orion-secondary'}`}>{crumb.label}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs text-orion-secondary mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
