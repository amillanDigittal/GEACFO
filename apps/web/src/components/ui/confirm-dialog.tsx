'use client'

import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'
import { Button } from './button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'warning' | 'default'
  onConfirm: () => void
  loading?: boolean
}

const variantConfig = {
  destructive: {
    icon: 'bg-destructive/10 border-destructive/20 text-destructive',
    button: 'destructive' as const,
  },
  warning: {
    icon: 'bg-warning/10 border-warning/20 text-warning',
    button: 'warning' as const,
  },
  default: {
    icon: 'bg-primary/10 border-primary/20 text-primary',
    button: 'default' as const,
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex flex-col items-center text-center gap-4 pt-2">
            <div className={`w-14 h-14 rounded-full border flex items-center justify-center ${config.icon}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-relaxed">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.button}
            className="flex-1"
            onClick={() => { onConfirm(); onOpenChange(false) }}
            disabled={loading}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
