import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  fullScreen?: boolean
  fullHeight?: boolean
}

export default function LoadingState({ message, fullScreen, fullHeight }: LoadingStateProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F2F2F2] z-50 select-none">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-orion-lg border border-gray-200 bg-white mb-4 animate-pulse">
          <img src="/logo.png" alt="ORION" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-center gap-2 text-gray-600 font-medium text-xs">
          <Loader2 size={16} className="animate-spin text-gray-500" />
          <span>{message || 'Loading ORION...'}</span>
        </div>
      </div>
    )
  }

  const cls = fullHeight
    ? 'flex-1 flex items-center justify-center py-12'
    : 'flex items-center justify-center py-8'

  return (
    <div className={cls}>
      <div className="flex flex-col items-center gap-2 text-orion-secondary">
        <Loader2 size={24} className="animate-spin" />
        {message && <p className="text-xs">{message}</p>}
      </div>
    </div>
  )
}
