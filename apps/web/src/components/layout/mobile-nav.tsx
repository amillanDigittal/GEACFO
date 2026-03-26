'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  CreditCard, ShieldAlert, SlidersHorizontal, Bell, Bot, Search,
  X, Link2, Banknote, Package, Users, Settings, ChevronUp,
} from 'lucide-react'

const QUICK_ROUTES = [
  { href: '/dashboard/cockpit', icon: <LayoutDashboard size={20} />, i18n: 'cockpit' },
  { href: '/dashboard/forecast', icon: <TrendingUp size={20} />, i18n: 'forecast' },
  { href: '/dashboard/cobros', icon: <ArrowDownToLine size={20} />, i18n: 'cobros' },
  { href: '/dashboard/pagos', icon: <ArrowUpFromLine size={20} />, i18n: 'pagos' },
  { href: '/dashboard/conciliacion', icon: <Link2 size={20} />, i18n: 'conciliacion' },
]

const ALL_ROUTES = [
  { href: '/dashboard/cockpit', icon: <LayoutDashboard size={18} />, i18n: 'cockpit' },
  { href: '/dashboard/forecast', icon: <TrendingUp size={18} />, i18n: 'forecast' },
  { href: '/dashboard/conciliacion', icon: <Link2 size={18} />, i18n: 'conciliacion' },
  { href: '/dashboard/cobros', icon: <ArrowDownToLine size={18} />, i18n: 'cobros' },
  { href: '/dashboard/pagos', icon: <ArrowUpFromLine size={18} />, i18n: 'pagos' },
  { href: '/dashboard/cashflow', icon: <Banknote size={18} />, i18n: 'cashflow' },
  { href: '/dashboard/deuda', icon: <CreditCard size={18} />, i18n: 'deuda' },
  { href: '/dashboard/scoring', icon: <ShieldAlert size={18} />, i18n: 'scoring' },
  { href: '/dashboard/inventario', icon: <Package size={18} />, i18n: 'inventario' },
  { href: '/dashboard/escenarios', icon: <SlidersHorizontal size={18} />, i18n: 'escenarios' },
  { href: '/dashboard/notificaciones', icon: <Bell size={18} />, i18n: 'notificaciones' },
  { href: '/dashboard/usuarios', icon: <Users size={18} />, i18n: 'usuarios' },
  { href: '/dashboard/configuracion', icon: <Settings size={18} />, i18n: 'configuracion' },
  { href: '/dashboard/bot', icon: <Bot size={18} />, i18n: 'bot' },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('nav')
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  // Listen for mobile sidebar toggle — intercept and open bottom sheet instead
  useEffect(() => {
    // Close on route change
    setOpen(false)
  }, [pathname])

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const filtered = search
    ? ALL_ROUTES.filter(r => t(r.i18n as any).toLowerCase().includes(search.toLowerCase()))
    : ALL_ROUTES

  return (
    <>
      {/* Fixed bottom bar — visible only on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border gradient-sep safe-bottom">
        <nav className="flex items-center justify-around px-1 h-14">
          {QUICK_ROUTES.map(route => {
            const active = pathname === route.href
            return (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[52px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {route.icon}
                <span className="text-[9px] font-medium leading-none">{t(route.i18n as any)}</span>
                {active && <span className="w-1 h-1 rounded-full bg-primary" />}
              </Link>
            )
          })}
          {/* More button */}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-muted-foreground min-w-[52px]"
          >
            <ChevronUp size={20} />
            <span className="text-[9px] font-medium leading-none">Más</span>
          </button>
        </nav>
      </div>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm bottom-sheet-backdrop"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border bottom-sheet-enter max-h-[85vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3">
              <h2 className="text-sm font-semibold text-foreground">Navegación</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted border border-border">
                <Search size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar módulo..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-muted-foreground">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Routes grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="grid grid-cols-3 gap-2">
                {filtered.map(route => {
                  const active = pathname === route.href
                  return (
                    <Link
                      key={route.href}
                      href={route.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all',
                        active
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {route.icon}
                      <span className="text-[10px] font-medium text-center leading-tight">{t(route.i18n as any)}</span>
                    </Link>
                  )
                })}
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Sin resultados para &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
