'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Printer, Check, Star } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/app'
import { useTranslations } from 'next-intl'

interface PageHeaderProps {
  title: string
  subtitle?: string
  lastUpdated: Date | null
  onRefresh: () => Promise<void> | void
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, lastUpdated, onRefresh, actions }: PageHeaderProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [done, setDone] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { favorites, toggleFavorite } = useAppStore()
  const tc = useTranslations('common')

  function fmtTime(d: Date) {
    const now = new Date()
    const diffS = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diffS < 10) return tc('timeNow')
    if (diffS < 60) return tc('timeSecsAgo', { secs: diffS })
    const diffM = Math.floor(diffS / 60)
    if (diffM < 60) return tc('timeMinsAgo', { mins: diffM })
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  async function handleRefresh() {
    setRefreshing(true)
    setDone(false)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setDone(true)
      // Flash verde en el header
      headerRef.current?.classList.add('refresh-flash')
      setTimeout(() => {
        setDone(false)
        headerRef.current?.classList.remove('refresh-flash')
      }, 1500)
    }
  }

  return (
    <div ref={headerRef} className="flex items-start justify-between flex-wrap gap-3 rounded-lg px-1 -mx-1 transition-colors">
      <div>
        <h1 className="page-title">{title}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
          {lastUpdated && (
            <>
              {subtitle && <span className="text-muted-foreground text-sm">·</span>}
              <span className="text-xs text-muted-foreground font-mono">{fmtTime(lastUpdated)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 print-hide">
        {actions}
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleFavorite(pathname)}
          aria-label={favorites.includes(pathname) ? tc('removeFavorite') : tc('addFavorite')}
        >
          <Star size={15} className={favorites.includes(pathname) ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : ''} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} aria-label={tc('printPage')}>
          <Printer size={14} />
        </Button>
        <Button
          variant={done ? 'success' : 'outline'}
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="min-w-[120px] relative overflow-hidden"
        >
          {done ? (
            <>
              <Check size={14} className="mr-1" />
              {tc('updated')}
            </>
          ) : (
            <>
              <RefreshCw size={14} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? tc('updating') : tc('refresh')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
