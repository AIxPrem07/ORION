import type { ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  fullHeight?: boolean
}

export function EmptyState({ icon, title, description, action, fullHeight }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-4 py-12 ${fullHeight ? 'flex-1' : ''}`}>
      {icon && <div className="text-gray-300 mb-4">{icon}</div>}
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-orion-secondary mb-4 max-w-xs">{description}</p>}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
