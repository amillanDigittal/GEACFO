'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  lastUpdated: Date | null
  onRefresh: () => Promise<void> | void
  actions?: React.ReactNode
}

function fmtTime(d: Date) {
  const now = new Date()
  const diffS = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diffS < 10) return 'Ahora'
  if (diffS < 60) return `Hace ${diffS}s`
  const diffM = Math.floor(diffS / 60)
  if (diffM < 60) return `Hace ${diffM} min`
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function PageHeader({ title, subtitle, lastUpdated, onRefresh, actions }: PageHeaderProps) {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {subtitle && <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
          {lastUpdated && (
            <>
              {subtitle && <span className="text-muted-foreground text-sm">·</span>}
              <span className="text-xs text-muted-foreground font-mono">{fmtTime(lastUpdated)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={14} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>
    </div>
  )
}
