'use client'

import { useState, useEffect } from 'react'
import { useSocket } from '@/providers/socket-provider'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotificationPrompt() {
  const { pushPermission, requestPushPermission } = useSocket()
  const [dismissed, setDismissed] = useState(true) // Start hidden, show after check
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    // Only show if permission is 'default' (not yet asked) and user hasn't dismissed before
    if (typeof window === 'undefined') return
    if (pushPermission !== 'default') return
    const wasDismissed = sessionStorage.getItem('geacfo-notif-dismissed')
    if (!wasDismissed) setDismissed(false)
  }, [pushPermission])

  if (dismissed || pushPermission !== 'default') return null

  async function handleEnable() {
    setRequesting(true)
    try {
      await requestPushPermission()
    } finally {
      setRequesting(false)
      setDismissed(true)
    }
  }

  function handleDismiss() {
    sessionStorage.setItem('geacfo-notif-dismissed', '1')
    setDismissed(true)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg mx-4 mt-2">
      <Bell size={16} className="text-primary flex-shrink-0" />
      <div className="flex-1 text-xs text-muted-foreground">
        <strong className="text-foreground">Activa las notificaciones</strong> para recibir alertas de pagos, covenants y anomalías en tiempo real.
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button size="sm" variant="default" className="h-7 text-xs" onClick={handleEnable} disabled={requesting}>
          {requesting ? 'Activando...' : 'Activar'}
        </Button>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
