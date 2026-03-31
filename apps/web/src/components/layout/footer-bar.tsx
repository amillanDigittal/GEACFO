'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

export function FooterBar() {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [lastSync, setLastSync] = useState('')
  const tc = useTranslations('common')

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

  return (
    <footer data-print-hide className="h-6 flex items-center justify-between px-4 text-[10px] text-muted-foreground/60 border-t border-border/30 bg-card/50 backdrop-blur-sm flex-shrink-0">
      <span className="font-mono">GEACFO v1.0</span>
      <div className="flex items-center gap-3">
        {lastSync && <span>{tc('syncLabel')} {lastSync}</span>}
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          {label}
        </span>
      </div>
    </footer>
  )
}
