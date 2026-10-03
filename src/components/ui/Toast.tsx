import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { Toast } from '@store/notification.store'
import { useNotificationStore } from '@store/notification.store'

const CONFIG = {
  success: { icon: CheckCircle2, className: 'border-green-200 bg-orion-primary text-green-800' },
  error: { icon: AlertCircle, className: 'border-red-200 bg-red-50 text-red-800' },
  warning: { icon: AlertTriangle, className: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
  info: { icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-800' },
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useNotificationStore()
  const { icon: Icon, className } = CONFIG[toast.type]
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border shadow-orion text-sm animate-slide-in min-w-[260px] max-w-sm ${className}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{toast.title}</p>
        {toast.message && <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>}
      </div>
      <button onClick={() => removeToast(toast.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  )
}
