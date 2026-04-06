'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/providers/socket-provider'
import { Users, AlertTriangle } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  CFO: 'CFO',
  CONTROLLER: 'Controller',
  ANALYST: 'Analista',
  VIEWER: 'Viewer',
}

export function FooterBar() {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [lastSync, setLastSync] = useState('')
  const tc = useTranslations('common')
  const { data: session } = useSession()
  const { isConnected, onlineUsers, notifications } = useSocket()

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/v1/health', { cache: 'no-store' })
        setHealthy(res.ok)
        setLastSync(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))
      } catch {
        setHealthy(false)
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  const dotClass = healthy === null
    ? 'bg-muted-foreground'
    : healthy
      ? 'bg-success'
      : 'bg-destructive'

  const label = healthy === null ? tc('apiChecking') : healthy ? tc('apiOk') : tc('apiOffline')

  const user = session?.user as any
  const userName = user?.name || user?.email || ''
  const userRole = ROLE_LABELS[user?.role] || user?.role || ''

  const criticalCount = notifications.filter(n => n.severity === 'critical').length

  return (
    <footer data-print-hide className="h-6 flex items-center justify-between px-4 text-[10px] text-muted-foreground/60 border-t border-border/30 bg-card/50 backdrop-blur-sm flex-shrink-0">
      {/* Left: version + user */}
      <div className="flex items-center gap-3">
        <span className="font-mono">GEACFO v1.0</span>
        {userName && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>{userName}</span>
            {userRole && <span className="text-muted-foreground/40">&middot; {userRole}</span>}
          </span>
        )}
      </div>

      {/* Center: online users */}
      <div className="flex items-center gap-1">
        {isConnected && onlineUsers.length > 0 && (
          <span className="flex items-center gap-1" title={onlineUsers.map(u => u.email).join(', ')}>
            <Users size={10} />
            <span>{onlineUsers.length} {tc('footerOnline')}</span>
          </span>
        )}
      </div>

      {/* Right: sync + health + alerts */}
      <div className="flex items-center gap-3">
        {lastSync && <span>{tc('syncLabel')} {lastSync}</span>}
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          {label}
        </span>
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-destructive font-medium">
            <AlertTriangle size={10} />
            {criticalCount}
          </span>
        )}
      </div>
    </footer>
  )
}
