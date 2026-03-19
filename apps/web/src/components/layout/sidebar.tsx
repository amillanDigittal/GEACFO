'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { api } from '@/lib/api'
import {
  BarChart3,
  LayoutDashboard,
  TrendingUp,
  Link2,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldAlert,
  Search,
  CreditCard,
  Package,
  SlidersHorizontal,
  TrendingDown,
  FolderOpen,
  Bot,
  FileText,
  Banknote,
  Bell,
  Users,
  Settings,
  BarChart3 as BarChartAbc,
  CalendarDays,
  Send,
} from 'lucide-react'

type BadgeCounts = Record<string, number>

const badgeKeyMap: Record<string, string> = {
  '/dashboard/scoring': 'scoring',
  '/dashboard/fraude': 'fraude',
  '/dashboard/cobros': 'cobros',
  '/dashboard/pagos': 'pagos',
  '/dashboard/forecast': 'forecast',
  '/dashboard/inventario': 'inventario',
  '/dashboard/gobierno': 'gobierno',
  '/dashboard/deuda': 'deuda',
}

const nav = [
  { href: '/dashboard/cockpit', label: 'Cockpit CFO', icon: <LayoutDashboard size={18} />, section: null },
  { section: 'Tesorería' },
  { href: '/dashboard/forecast', label: 'Forecast 13 Semanas', icon: <TrendingUp size={18} /> },
  { href: '/dashboard/conciliacion', label: 'Conciliación Bancaria', icon: <Link2 size={18} /> },
  { href: '/dashboard/cobros', label: 'Cuentas por Cobrar', icon: <ArrowDownToLine size={18} /> },
  { href: '/dashboard/pagos', label: 'Cuentas por Pagar', icon: <ArrowUpFromLine size={18} /> },
  { href: '/dashboard/cashflow', label: 'Estado de Flujos', icon: <Banknote size={18} /> },
  { href: '/dashboard/vencimientos', label: 'Mapa de Vencimientos', icon: <CalendarDays size={18} /> },
  { href: '/dashboard/proyeccion-diaria', label: 'Proyección Diaria', icon: <TrendingUp size={18} /> },
  { section: 'Riesgo' },
  { href: '/dashboard/scoring', label: 'Scoring de Clientes', icon: <ShieldAlert size={18} /> },
  { href: '/dashboard/fraude', label: 'Fraude & Compliance', icon: <Search size={18} /> },
  { section: 'Deuda' },
  { href: '/dashboard/deuda', label: 'Deuda & Covenants', icon: <CreditCard size={18} /> },
  { section: 'Inventario' },
  { href: '/dashboard/inventario', label: 'Gestión de Inventario', icon: <Package size={18} /> },
  { href: '/dashboard/inventario-abc', label: 'Análisis ABC', icon: <BarChartAbc size={18} /> },
  { section: 'Planificación' },
  { href: '/dashboard/escenarios', label: 'Supuestos & Escenarios', icon: <SlidersHorizontal size={18} /> },
  { href: '/dashboard/variance', label: 'Variance Analysis', icon: <TrendingDown size={18} /> },
  { href: '/dashboard/ratios', label: 'Ratios Financieros', icon: <BarChartAbc size={18} /> },
  { section: 'Plataforma' },
  { href: '/dashboard/notificaciones', label: 'Centro de Alertas', icon: <Bell size={18} /> },
  { href: '/dashboard/usuarios', label: 'Gestión de Usuarios', icon: <Users size={18} /> },
  { href: '/dashboard/configuracion', label: 'Configuración', icon: <Settings size={18} /> },
  { href: '/dashboard/gobierno', label: 'Gobierno del Dato', icon: <FolderOpen size={18} /> },
  { href: '/dashboard/bot', label: 'Bot CFO', icon: <Bot size={18} /> },
  { href: '/dashboard/boardpack', label: 'Board Pack', icon: <FileText size={18} /> },
  { href: '/dashboard/reporting', label: 'Reporting', icon: <Send size={18} /> },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const [badges, setBadges] = useState<BadgeCounts>({})

  useEffect(() => {
    api.alerts.counts()
      .then(setBadges)
      .catch(() => {})
  }, [])

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarCollapsed(true)
    }
  }, [pathname, setSidebarCollapsed])

  return (
    <>
    {/* Mobile overlay backdrop */}
    {!sidebarCollapsed && (
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarCollapsed(true)} />
    )}
    <nav aria-label="Navegación principal" className={cn(
      'flex flex-col bg-card border-r border-border transition-all duration-300 overflow-hidden flex-shrink-0 z-50',
      // Mobile: hidden by default, overlay when open
      'fixed md:relative h-full',
      sidebarCollapsed ? 'w-0 md:w-[60px]' : 'w-[260px]'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-[60px] border-b border-border flex-shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-[hsl(var(--gold))] rounded-lg flex items-center justify-center flex-shrink-0"><BarChart3 size={16} className="text-white" /></div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <div className="font-display text-base font-bold text-foreground leading-none">GEACFO</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">CFO Intelligence</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        {nav.map((item, i) => {
          if ('section' in item && item.section) {
            if (sidebarCollapsed) return <div key={i} className="h-px bg-border mx-2 my-1.5" />
            return (
              <div key={i} className="px-4 pt-3 pb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{item.section}</span>
              </div>
            )
          }
          if (!item.href) return null
          const active = pathname === item.href
          const badgeKey = badgeKeyMap[item.href]
          const badgeCount = badgeKey ? badges[badgeKey] : undefined
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn(
              'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors relative',
              sidebarCollapsed && 'justify-center px-2',
              active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}>
              {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full" />}
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              {!sidebarCollapsed && badgeCount !== undefined && badgeCount > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badgeCount}</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* User */}
      {!sidebarCollapsed && (
        <div className="p-3 border-t border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--gold))] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AC</div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-foreground truncate">Ana Castro</div>
            <div className="text-[11px] text-muted-foreground truncate">CFO · Grupo Ibérico</div>
          </div>
        </div>
      )}
    </nav>
    </>
  )
}
