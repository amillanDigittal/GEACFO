'use client'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
import { useTheme } from 'next-themes'
import { useNotifications } from '@/hooks/use-api'
import { FileText, Bot, Bell, Sun, Moon, Menu, X, CheckCircle2, LogOut, ChevronRight, Home, Search, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useSocket, RealtimeNotification } from '@/providers/socket-provider'
import { setLocale } from '@/i18n/set-locale'
import { type Locale, locales } from '@/i18n/config'

const BREADCRUMBS: Record<string, { section: string; label: string }> = {
  '/dashboard/cockpit': { section: '', label: 'Cockpit CFO' },
  '/dashboard/forecast': { section: 'Tesorería', label: 'Forecast 13S' },
  '/dashboard/conciliacion': { section: 'Tesorería', label: 'Conciliación' },
  '/dashboard/cobros': { section: 'Tesorería', label: 'Cobros' },
  '/dashboard/pagos': { section: 'Tesorería', label: 'Pagos' },
  '/dashboard/cashflow': { section: 'Tesorería', label: 'Flujos' },
  '/dashboard/vencimientos': { section: 'Tesorería', label: 'Vencimientos' },
  '/dashboard/proyeccion-diaria': { section: 'Tesorería', label: 'Proyección Diaria' },
  '/dashboard/scoring': { section: 'Riesgo', label: 'Scoring' },
  '/dashboard/fraude': { section: 'Riesgo', label: 'Fraude' },
  '/dashboard/deuda': { section: 'Deuda', label: 'Deuda & Covenants' },
  '/dashboard/inventario': { section: 'Inventario', label: 'Inventario' },
  '/dashboard/inventario-abc': { section: 'Inventario', label: 'Análisis ABC' },
  '/dashboard/escenarios': { section: 'Planificación', label: 'Escenarios' },
  '/dashboard/variance': { section: 'Planificación', label: 'Variance' },
  '/dashboard/ratios': { section: 'Planificación', label: 'Ratios' },
  '/dashboard/notificaciones': { section: 'Plataforma', label: 'Alertas' },
  '/dashboard/usuarios': { section: 'Plataforma', label: 'Usuarios' },
  '/dashboard/configuracion': { section: 'Plataforma', label: 'Configuración' },
  '/dashboard/gobierno': { section: 'Plataforma', label: 'Gobierno' },
  '/dashboard/auditoria': { section: 'Plataforma', label: 'Auditoría' },
  '/dashboard/bot': { section: 'Plataforma', label: 'Bot CFO' },
  '/dashboard/boardpack': { section: 'Plataforma', label: 'Board Pack' },
  '/dashboard/reporting': { section: 'Plataforma', label: 'Reporting' },
}

interface Notification {
  id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  icon: string
  title: string
  description: string
  link: string
  timestamp: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 0) return 'próximamente'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

export function Topbar({ session }: { session: any }) {
  const pathname = usePathname()
  const { toggleSidebar } = useAppStore()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const locale = useLocale() as Locale
  // Defer client-only values to avoid SSR/client hydration mismatch
  const [mounted, setMounted] = useState(false)
  const [date, setDate] = useState('')
  useEffect(() => {
    setMounted(true)
    setDate(new Date().toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }))
  }, [])

  const { data: notifications = [] } = useNotifications()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)
  const { notifications: realtimeNotifs, isConnected: wsConnected, clearNotifications: clearRealtime, requestPushPermission, pushPermission } = useSocket()
  const [hasNewRealtime, setHasNewRealtime] = useState(false)
  const prevRealtimeCount = useRef(0)

  // Flash the bell when new realtime notifications arrive
  useEffect(() => {
    if (realtimeNotifs.length > prevRealtimeCount.current) {
      setHasNewRealtime(true)
      const timer = setTimeout(() => setHasNewRealtime(false), 3000)
      prevRealtimeCount.current = realtimeNotifs.length
      return () => clearTimeout(timer)
    }
    prevRealtimeCount.current = realtimeNotifs.length
  }, [realtimeNotifs.length])

  // Close panel on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Merge realtime notifications (at top) with REST-fetched ones
  const realtimeAsNotifications: Notification[] = realtimeNotifs.map(n => ({
    ...n,
    icon: n.severity === 'critical' ? '🚨' : n.severity === 'warning' ? '⚠️' : '✅',
  }))
  const allNotifications = [...realtimeAsNotifications, ...notifications]
  const activeNotifications = allNotifications.filter(n => !dismissed.has(n.id))
  const criticalCount = activeNotifications.filter(n => n.severity === 'critical').length
  const totalCount = activeNotifications.length

  function handleDismiss(id: string) {
    setDismissed(prev => new Set(prev).add(id))
  }

  function handleClick(notification: Notification) {
    setOpen(false)
    router.push(notification.link)
  }

  const severityStyles: Record<string, { bg: string; border: string; dot: string }> = {
    critical: { bg: 'bg-destructive/5', border: 'border-destructive/20', dot: 'bg-destructive' },
    warning: { bg: 'bg-warning/5', border: 'border-warning/20', dot: 'bg-warning' },
    info: { bg: 'bg-muted/50', border: 'border-border', dot: 'bg-muted-foreground' },
  }

  return (
    <header data-print-hide className="h-[60px] bg-card/80 backdrop-blur-xl border-b border-border gradient-sep flex items-center px-4 gap-3 flex-shrink-0 sticky top-0 z-40">
      <button onClick={toggleSidebar} aria-label="Abrir menú lateral" className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Menu size={18} /></button>
      <nav aria-label="Migas de pan" className="flex items-center gap-1 text-sm text-muted-foreground min-w-0 overflow-hidden">
        <Link href="/dashboard/cockpit" aria-label="Ir al Cockpit" className="hover:text-foreground transition-colors flex-shrink-0">
          <Home size={14} />
        </Link>
        {(() => {
          const crumb = BREADCRUMBS[pathname]
          if (!crumb) return <><ChevronRight size={12} className="flex-shrink-0 opacity-40 breadcrumb-enter" /><span key={pathname} className="text-foreground font-medium truncate breadcrumb-enter">Dashboard</span></>
          return (
            <>
              {crumb.section && (
                <>
                  <ChevronRight size={12} className="flex-shrink-0 opacity-40 breadcrumb-enter" />
                  <span key={`${pathname}-section`} className="hidden sm:inline truncate breadcrumb-enter">{crumb.section}</span>
                </>
              )}
              <ChevronRight size={12} className="flex-shrink-0 opacity-40 breadcrumb-enter" style={{ animationDelay: '80ms' }} />
              <span key={pathname} className="text-foreground font-medium truncate breadcrumb-enter" style={{ animationDelay: '120ms' }}>{crumb.label}</span>
            </>
          )
        })()}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs"
        >
          <Search size={13} />
          <span>Buscar...</span>
          <kbd className="ml-1 inline-flex h-4 items-center gap-0.5 rounded border border-border bg-background px-1 text-[10px] font-mono">⌘K</kbd>
        </button>
        <span className="text-xs text-muted-foreground font-mono hidden sm:block">{date}</span>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/boardpack')} className="text-xs hidden md:flex"><FileText size={14} className="mr-1" />Board Pack</Button>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/bot')} className="text-xs hidden md:flex"><Bot size={14} className="mr-1" />Bot CFO</Button>

        {/* Notification bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen(!open)}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative ${hasNewRealtime ? 'animate-pulse' : ''}`}
            aria-label={`Notificaciones${totalCount > 0 ? `, ${totalCount} pendientes` : ''}${wsConnected ? ' · Tiempo real activo' : ''}`}
            aria-expanded={open}
            aria-haspopup="true"
          >
            <Bell size={16} />
            {totalCount > 0 && (
              <span aria-hidden="true" className={`absolute -top-0.5 -right-0.5 text-[9px] font-bold px-1 py-0 rounded-full text-white min-w-[16px] text-center ${criticalCount > 0 ? 'bg-destructive' : 'bg-warning'}`}>
                {totalCount}
              </span>
            )}
            {wsConnected && (
              <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-card" title="Tiempo real activo" />
            )}
          </button>

          {/* Notification panel */}
          {open && (
            <div className="absolute right-0 top-10 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[480px] bg-card border border-border rounded-xl shadow-2xl z-[100] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Notificaciones</span>
                  {criticalCount > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{criticalCount} crítica{criticalCount > 1 ? 's' : ''}</span>
                  )}
                  <span className={`flex items-center gap-1 text-[10px] ${wsConnected ? 'text-success' : 'text-muted-foreground'}`} title={wsConnected ? 'Conectado en tiempo real' : 'Sin conexión en tiempo real'}>
                    {wsConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {wsConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
                {activeNotifications.length > 0 && (
                  <button
                    onClick={() => { setDismissed(new Set(allNotifications.map(n => n.id))); clearRealtime() }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Marcar todo leído
                  </button>
                )}
              </div>

              {/* Push permission prompt */}
              {pushPermission === 'default' && (
                <div className="px-4 py-2.5 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Recibir alertas críticas aunque la pestaña no tenga foco</span>
                  <button
                    onClick={requestPushPermission}
                    className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    Activar
                  </button>
                </div>
              )}

              {/* Notifications list */}
              <div className="flex-1 overflow-y-auto">
                {activeNotifications.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="mb-2 opacity-30"><CheckCircle2 size={24} className="text-muted-foreground" /></div>
                    <div className="text-sm text-muted-foreground">Sin notificaciones pendientes</div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {activeNotifications.map(n => {
                      const styles = severityStyles[n.severity] || severityStyles.info
                      return (
                        <div
                          key={n.id}
                          className={`flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${styles.bg}`}
                          onClick={() => handleClick(n)}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <span className="text-base">{n.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-semibold text-foreground leading-tight">{n.title}</div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDismiss(n.id) }}
                                className="text-muted-foreground hover:text-foreground text-xs flex-shrink-0 mt-0.5"
                                aria-label={`Descartar notificación: ${n.title}`}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.description}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                              <span className="text-[10px] text-muted-foreground">{n.type} · {timeAgo(n.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {activeNotifications.length > 0 && (
                <div className="border-t border-border px-4 py-2">
                  <button
                    onClick={() => { setOpen(false); router.push('/dashboard/notificaciones') }}
                    className="text-[11px] text-primary hover:underline w-full text-center"
                  >
                    Ver todas las alertas →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            const next = locale === 'es' ? 'en' : 'es'
            await setLocale(next as Locale)
            router.refresh()
          }}
          aria-label={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          className="h-7 px-2 rounded-md text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border uppercase"
        >
          {locale === 'es' ? 'EN' : 'ES'}
        </button>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" suppressHydrationWarning>
          {mounted ? (theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />) : <div className="w-4 h-4" />}
        </button>
        <button onClick={() => signOut()} aria-label="Cerrar sesión" className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"><LogOut size={14} /></button>
      </div>
    </header>
  )
}
