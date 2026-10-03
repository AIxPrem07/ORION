import { useUIStore, type ConfirmModal } from '@store/ui.store'
import { Button } from './Button'
import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog(props: ConfirmModal) {
  const { closeConfirm } = useUIStore()
  const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', onConfirm } = props

  async function handleConfirm() {
    closeConfirm()
    await onConfirm()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 animate-fade-in">
      <div className="bg-white rounded-lg shadow-orion-lg w-full max-w-sm mx-4 p-6">
        {variant === 'danger' && (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 mb-4">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
        )}
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={closeConfirm}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
