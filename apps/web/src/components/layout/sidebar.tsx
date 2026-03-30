'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useHydrated } from '@/hooks/use-hydrated'
import { useAlertCounts } from '@/hooks/use-api'
import { useTranslations } from 'next-intl'
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
  Calculator,
  Wallet,
  Truck,
  Smartphone,
  Upload,
  Star,
  Pin,
  ClipboardList,
  ChevronDown,
} from 'lucide-react'

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

/** Routes to eagerly prefetch (most visited) */
const PREFETCH_ROUTES = new Set(['/dashboard/cockpit', '/dashboard/forecast', '/dashboard/pagos'])

/** Nav items use i18n keys resolved at render time via t('nav.key'). */
const nav = [
  { href: '/dashboard/cockpit', i18n: 'cockpit', icon: <LayoutDashboard size={18} />, section: null },
  { href: '/dashboard/resumen', i18n: 'resumen', icon: <Smartphone size={18} /> },
  { section: 'treasury' },
  { href: '/dashboard/forecast', i18n: 'forecast', icon: <TrendingUp size={18} /> },
  { href: '/dashboard/conciliacion', i18n: 'conciliacion', icon: <Link2 size={18} /> },
  { href: '/dashboard/cobros', i18n: 'cobros', icon: <ArrowDownToLine size={18} /> },
  { href: '/dashboard/pagos', i18n: 'pagos', icon: <ArrowUpFromLine size={18} /> },
  { href: '/dashboard/proveedores', i18n: 'proveedores', icon: <Truck size={18} /> },
  { href: '/dashboard/cashflow', i18n: 'cashflow', icon: <Banknote size={18} /> },
  { href: '/dashboard/vencimientos', i18n: 'vencimientos', icon: <CalendarDays size={18} /> },
  { href: '/dashboard/proyeccion-diaria', i18n: 'proyeccionDiaria', icon: <TrendingUp size={18} /> },
  { section: 'risk' },
  { href: '/dashboard/scoring', i18n: 'scoring', icon: <ShieldAlert size={18} /> },
  { href: '/dashboard/provisiones', i18n: 'provisiones', icon: <Calculator size={18} /> },
  { href: '/dashboard/fraude', i18n: 'fraude', icon: <Search size={18} /> },
  { section: 'debt' },
  { href: '/dashboard/deuda', i18n: 'deuda', icon: <CreditCard size={18} /> },
  { section: 'inventory' },
  { href: '/dashboard/inventario', i18n: 'inventario', icon: <Package size={18} /> },
  { href: '/dashboard/inventario-abc', i18n: 'inventarioAbc', icon: <BarChartAbc size={18} /> },
  { section: 'planning' },
  { href: '/dashboard/presupuesto', i18n: 'presupuesto', icon: <Wallet size={18} /> },
  { href: '/dashboard/escenarios', i18n: 'escenarios', icon: <SlidersHorizontal size={18} /> },
  { href: '/dashboard/variance', i18n: 'variance', icon: <TrendingDown size={18} /> },
  { href: '/dashboard/ratios', i18n: 'ratios', icon: <BarChartAbc size={18} /> },
  { section: 'platform' },
  { href: '/dashboard/notificaciones', i18n: 'notificaciones', icon: <Bell size={18} /> },
  { href: '/dashboard/usuarios', i18n: 'usuarios', icon: <Users size={18} /> },
  { href: '/dashboard/configuracion', i18n: 'configuracion', icon: <Settings size={18} /> },
  { href: '/dashboard/importar', i18n: 'importar', icon: <Upload size={18} /> },
  { href: '/dashboard/gobierno', i18n: 'gobierno', icon: <FolderOpen size={18} /> },
  { href: '/dashboard/auditoria', i18n: 'auditoria', icon: <ClipboardList size={18} /> },
  { href: '/dashboard/bot', i18n: 'bot', icon: <Bot size={18} /> },
  { href: '/dashboard/boardpack', i18n: 'boardpack', icon: <FileText size={18} /> },
  { href: '/dashboard/reporting', i18n: 'reporting', icon: <Send size={18} /> },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, setSidebarCollapsed, favorites, toggleFavorite } = useAppStore()
  const hydrated = useHydrated()
  const { data: badges = {} } = useAlertCounts()
  const t = useTranslations('nav')

  // Use stable defaults during SSR and first client render to avoid hydration mismatch.
  const collapsed = hydrated ? sidebarCollapsed : false
  const favs = hydrated ? favorites : []

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  // Compute badge count per section
  const sectionBadgeTotals: Record<string, number> = {}
  let currentSection = ''
  for (const item of nav) {
    if ('section' in item && item.section) { currentSection = item.section; continue }
    if ('href' in item && item.href) {
      const bk = badgeKeyMap[item.href]
      if (bk && badges[bk]) {
        sectionBadgeTotals[currentSection] = (sectionBadgeTotals[currentSection] || 0) + badges[bk]
      }
    }
  }

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarCollapsed(true)
    }
  }, [pathname, setSidebarCollapsed])

  return (
    <div data-print-hide>
    {/* Mobile overlay backdrop — hidden on mobile (bottom sheet replaces it) */}
    {!collapsed && (
      <div className="fixed inset-0 bg-black/50 z-40 hidden md:hidden" onClick={() => setSidebarCollapsed(true)} />
    )}
    <nav aria-label="Navegación principal" className={cn(
      'flex flex-col backdrop-blur-xl transition-all duration-300 overflow-hidden flex-shrink-0 z-50 sidebar-glass',
      // Mobile: always hidden (bottom sheet handles navigation), Desktop: collapsible
      'hidden md:flex md:relative h-full',
      collapsed ? 'md:w-[60px]' : 'md:w-[260px]'
    )}>
      {/* Logo */}
      <div className="sidebar-logo-area flex items-center gap-3 px-4 h-[60px] border-b border-white/[0.06] flex-shrink-0 cursor-pointer">
        <div className="sidebar-logo w-9 h-9 bg-gradient-to-br from-primary to-[hsl(var(--gold))] rounded-lg flex items-center justify-center flex-shrink-0 relative"><BarChart3 size={18} className="text-white relative z-10" /></div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-display text-base font-bold text-foreground leading-none">GEACFO</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">{t('cfoIntelligence')}</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Favorites section */}
        {favs.length > 0 && (
          <>
            {!collapsed ? (
              <div className="px-4 pt-1 pb-1">
                <span className="text-[10px] font-semibold text-[hsl(var(--gold))] uppercase tracking-widest flex items-center gap-1"><Star size={9} className="fill-current" />{t('favorites')}</span>
              </div>
            ) : (
              <div className="h-px bg-[hsl(var(--gold))]/30 mx-2 my-1.5" />
            )}
            {favs.map(href => {
              const item = nav.find(n => 'href' in n && n.href === href)
              if (!item || !('href' in item) || !item.href) return null
              const active = pathname === item.href
              const badgeKey = badgeKeyMap[item.href]
              const badgeCount = badgeKey ? badges[badgeKey] : undefined
              return (
                <div key={`fav-${item.href}`} className="group relative">
                  <Link href={item.href} prefetch={PREFETCH_ROUTES.has(item.href!)} aria-current={active ? 'page' : undefined} className={cn(
                    'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors relative',
                    collapsed && 'justify-center px-2',
                    active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}>
                        <span className="sidebar-nav-icon text-base flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{'i18n' in item ? t(item.i18n as any) : ''}</span>}
                    {!collapsed && badgeCount !== undefined && badgeCount > 0 && (
                      <span key={badgeCount} className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full sidebar-badge">{badgeCount}</span>
                    )}
                  </Link>
                  {!collapsed && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.href!) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                      title={t('removeFavorite')}
                    >
                      <Star size={12} className="text-[hsl(var(--gold))] fill-[hsl(var(--gold))]" />
                    </button>
                  )}
                </div>
              )
            })}
            {collapsed ? (
              <div className="h-px bg-border mx-2 my-1.5" />
            ) : (
              <div className="h-px bg-border mx-4 my-1.5" />
            )}
          </>
        )}

        {(() => {
          let curSection = ''
          return nav.map((item, i) => {
            if ('section' in item && item.section) {
              curSection = item.section
              if (collapsed) return <div key={i} className="h-px bg-border mx-2 my-1.5" />
              const isOpen = !collapsedSections.has(item.section)
              const sectionTotal = sectionBadgeTotals[item.section]
              return (
                <button
                  key={i}
                  onClick={() => toggleSection(item.section!)}
                  className="w-full px-4 pt-3 pb-1 flex items-center gap-1.5 group/section hover:bg-muted/30 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{t(item.section as any)}</span>
                  {sectionTotal > 0 && (
                    <span className="ml-1 bg-destructive/15 text-destructive text-[9px] font-bold px-1.5 py-0.5 rounded-full">{sectionTotal}</span>
                  )}
                  <ChevronDown size={10} className={cn(
                    'ml-auto text-muted-foreground transition-transform duration-200',
                    !isOpen && '-rotate-90'
                  )} />
                </button>
              )
            }
            if (!item.href) return null
            // Hide items in collapsed sections
            if (!collapsed && collapsedSections.has(curSection)) return null
            const active = pathname === item.href
            const badgeKey = badgeKeyMap[item.href]
            const badgeCount = badgeKey ? badges[badgeKey] : undefined
            const isFav = favs.includes(item.href)
            return (
              <div key={item.href} className="group relative">
                <Link href={item.href} prefetch={PREFETCH_ROUTES.has(item.href)} aria-current={active ? 'page' : undefined} className={cn(
                  'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors relative',
                  collapsed && 'justify-center px-2',
                  active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}>
                  <span className="sidebar-nav-icon text-base flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{'i18n' in item ? t(item.i18n as any) : ''}</span>}
                  {!collapsed && badgeCount !== undefined && badgeCount > 0 && (
                    <span key={badgeCount} className={cn('ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full sidebar-badge group-hover:mr-5', isFav && 'mr-5')}>
                      {badgeCount}
                    </span>
                  )}
                </Link>
                {!collapsed && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.href!) }}
                    className={cn(
                      'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all',
                      isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 hover:bg-muted',
                    )}
                    title={isFav ? t('removeFavorite') : t('addFavorite')}
                  >
                    <Star size={12} className={isFav ? 'text-[hsl(var(--gold))] fill-[hsl(var(--gold))]' : 'text-muted-foreground hover:text-[hsl(var(--gold))]'} />
                  </button>
                )}
              </div>
            )
          })
        })()}
      </div>

      {/* User */}
      {!collapsed && (
        <div className="p-3 border-t border-white/[0.06] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--gold))] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AC</div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-foreground truncate">Ana Castro</div>
            <div className="text-[11px] text-muted-foreground truncate">CFO · Grupo Ibérico</div>
          </div>
        </div>
      )}
    </nav>
    </div>
  )
}
