'use client'

import { useConnectionStatus, ConnectionState } from '@/hooks/use-connection-status'
import { getLastFetchAt } from '@/lib/api'
import { WifiOff, ServerOff, RefreshCw, X } from 'lucide-react'
import { useState, useEffect } from 'react'

const CONFIG: Record<Exclude<ConnectionState, 'connected'>, {
  icon: typeof WifiOff
  title: string
  bg: string
  border: string
}> = {
  offline: {
    icon: WifiOff,
    title: 'Sin conexión',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
  },
  'api-down': {
    icon: ServerOff,
    title: 'El servidor no responde',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
  },
}

function formatStaleAge(ms: number): string {
  if (ms < 60_000) return 'hace menos de 1 min'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  return `hace ${hours}h ${mins % 60}min`
}

export function ConnectionBanner() {
  const { state, retrying, retry } = useConnectionStatus()
  const [dismissed, setDismissed] = useState(false)
  const [staleLabel, setStaleLabel] = useState('')

  // Reset dismissed when state changes
  useEffect(() => {
    if (state !== 'connected') setDismissed(false)
  }, [state])

  // Update stale age label every 30s while disconnected
  useEffect(() => {
    if (state === 'connected') {
      setStaleLabel('')
      return
    }
    const update = () => {
      const age = Date.now() - getLastFetchAt()
      setStaleLabel(formatStaleAge(age))
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [state])

  if (state === 'connected' || dismissed) return null

  const cfg = CONFIG[state]
  const Icon = cfg.icon

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b ${cfg.bg} ${cfg.border} animate-in slide-in-from-top duration-300`}
    >
      <Icon size={16} className="flex-shrink-0 text-foreground/70" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">{cfg.title}</span>
        {staleLabel && (
          <span className="text-muted-foreground ml-2 text-xs">— datos de {staleLabel}</span>
        )}
      </div>
      <button
        onClick={() => retry()}
        disabled={retrying}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors disabled:opacity-50"
      >
        <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">Reintentar</span>
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Cerrar aviso de conexión"
      >
        <X size={14} />
      </button>
    </div>
  )
}
