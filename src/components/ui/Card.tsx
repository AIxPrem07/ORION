import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white border border-orion-border rounded-lg shadow-orion ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  subvalue?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function StatCard({ label, value, subvalue, icon, trend, trendValue }: StatCardProps) {
  return (
    <div className="bg-white border border-orion-border rounded-lg p-4 shadow-orion">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-orion-secondary font-medium uppercase tracking-wide">{label}</p>
        {icon && <div className="text-orion-secondary">{icon}</div>}
      </div>
      <p className="text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {subvalue && <p className="text-xs text-orion-secondary mt-0.5">{subvalue}</p>}
      {trendValue && (
        <p className={`text-xs mt-1 font-medium ${
          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
        }`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''} {trendValue}
        </p>
      )}
    </div>
  )
}
