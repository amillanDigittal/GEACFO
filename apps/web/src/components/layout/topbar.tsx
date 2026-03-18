'use client'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
import { useTheme } from 'next-themes'
import { api } from '@/lib/api'
import { FileText, Bot, Bell, Sun, Moon, Menu, X, CheckCircle2, LogOut } from 'lucide-react'

const BREADCRUMBS: Record<string, string> = {
  '/dashboard/cockpit': 'Cockpit CFO', '/dashboard/forecast': 'Forecast 13 Semanas',
  '/dashboard/conciliacion': 'Conciliación Bancaria', '/dashboard/cobros': 'Cuentas por Cobrar',
  '/dashboard/pagos': 'Cuentas por Pagar', '/dashboard/scoring': 'Scoring de Clientes',
  '/dashboard/fraude': 'Fraude & Compliance', '/dashboard/deuda': 'Deuda & Covenants',
  '/dashboard/inventario': 'Inventario', '/dashboard/escenarios': 'Supuestos & Escenarios',
  '/dashboard/variance': 'Variance Analysis', '/dashboard/gobierno': 'Gobierno del Dato',
  '/dashboard/bot': 'Bot CFO', '/dashboard/boardpack': 'Board Pack',
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
  const date = new Date().toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.alerts.notifications()
      .then(setNotifications)
      .catch(() => {})
  }, [])

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

  const activeNotifications = notifications.filter(n => !dismissed.has(n.id))
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
    <header className="h-[60px] bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
      <button onClick={toggleSidebar} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Menu size={18} /></button>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>GEACFO</span>
        <span>›</span>
        <span className="text-foreground font-medium">{BREADCRUMBS[pathname] || 'Dashboard'}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono hidden sm:block">{date}</span>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/boardpack')} className="text-xs hidden md:flex"><FileText size={14} className="mr-1" />Board Pack</Button>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/bot')} className="text-xs hidden md:flex"><Bot size={14} className="mr-1" />Bot CFO</Button>

        {/* Notification bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen(!open)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative"
            title="Notificaciones"
          >
            <Bell size={16} />
            {totalCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 text-[9px] font-bold px-1 py-0 rounded-full text-white min-w-[16px] text-center ${criticalCount > 0 ? 'bg-destructive' : 'bg-warning'}`}>
                {totalCount}
              </span>
            )}
          </button>

          {/* Notification panel */}
          {open && (
            <div className="absolute right-0 top-10 w-[380px] max-h-[480px] bg-card border border-border rounded-xl shadow-2xl z-[100] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Notificaciones</span>
                  {criticalCount > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{criticalCount} crítica{criticalCount > 1 ? 's' : ''}</span>
                  )}
                </div>
                {activeNotifications.length > 0 && (
                  <button
                    onClick={() => setDismissed(new Set(notifications.map(n => n.id)))}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Marcar todo leído
                  </button>
                )}
              </div>

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
                                title="Descartar"
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
                    onClick={() => { setOpen(false); router.push('/dashboard/fraude') }}
                    className="text-[11px] text-primary hover:underline w-full text-center"
                  >
                    Ver todas las alertas →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={() => signOut()} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive transition-colors" title="Cerrar sesión"><LogOut size={14} /></button>
      </div>
    </header>
  )
}
