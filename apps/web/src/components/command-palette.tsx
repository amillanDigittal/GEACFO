'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { useCustomers, useAR, useAP, useSuppliers } from '@/hooks/use-api'
import { fmtEur } from '@/lib/utils'
import {
  LayoutDashboard, TrendingUp, Link2, ArrowDownToLine, ArrowUpFromLine, ShieldAlert,
  Search, CreditCard, Package, SlidersHorizontal, TrendingDown, FolderOpen, Bot,
  FileText, Banknote, Bell, Users, Settings, Calculator, Wallet, Truck, Smartphone,
  Upload, Send, CalendarDays, BarChart3, ClipboardList, Clock, Gauge, Landmark, Target,
  Download, Plus, Coins,
} from 'lucide-react'

interface SearchResult {
  id: string
  type: 'page' | 'customer' | 'invoice_ar' | 'invoice_ap' | 'supplier' | 'action' | 'kpi'
  title: string
  description: string
  icon: React.ReactNode
  href?: string
  action?: () => void
}

const PAGES: { href: string; label: string; keywords: string; icon: React.ReactNode }[] = [
  { href: '/dashboard/cockpit', label: 'Cockpit CFO', keywords: 'inicio home dashboard resumen kpi', icon: <LayoutDashboard size={16} /> },
  { href: '/dashboard/resumen', label: 'Resumen Ejecutivo', keywords: 'movil mobile resumen dia', icon: <Smartphone size={16} /> },
  { href: '/dashboard/forecast', label: 'Forecast 13 Semanas', keywords: 'prevision cash caja semanas proyeccion', icon: <TrendingUp size={16} /> },
  { href: '/dashboard/conciliacion', label: 'Conciliación Bancaria', keywords: 'banco movimientos reconciliacion extracto', icon: <Link2 size={16} /> },
  { href: '/dashboard/cobros', label: 'Cuentas por Cobrar', keywords: 'ar facturas clientes cobro ingresos', icon: <ArrowDownToLine size={16} /> },
  { href: '/dashboard/pagos', label: 'Cuentas por Pagar', keywords: 'ap facturas proveedores pago gastos', icon: <ArrowUpFromLine size={16} /> },
  { href: '/dashboard/proveedores', label: 'Gestión de Proveedores', keywords: 'proveedor supplier scoring fiabilidad', icon: <Truck size={16} /> },
  { href: '/dashboard/cashflow', label: 'Estado de Flujos', keywords: 'cash flow flujo efectivo operativo', icon: <Banknote size={16} /> },
  { href: '/dashboard/vencimientos', label: 'Mapa de Vencimientos', keywords: 'vencimiento calendario plazo due', icon: <CalendarDays size={16} /> },
  { href: '/dashboard/scoring', label: 'Scoring de Clientes', keywords: 'riesgo credito score cliente rating', icon: <ShieldAlert size={16} /> },
  { href: '/dashboard/provisiones', label: 'Provisión Insolvencia', keywords: 'provision niif ecl insolvencia dudoso', icon: <Calculator size={16} /> },
  { href: '/dashboard/fraude', label: 'Fraude & Compliance', keywords: 'fraude anomalia duplicado compliance', icon: <Search size={16} /> },
  { href: '/dashboard/deuda', label: 'Deuda & Covenants', keywords: 'deuda prestamo covenant ratio apalancamiento', icon: <CreditCard size={16} /> },
  { href: '/dashboard/fx', label: 'FX / Riesgo Divisa', keywords: 'fx divisa cambio currency exchange rate forex riesgo', icon: <Coins size={16} /> },
  { href: '/dashboard/inventario', label: 'Gestión de Inventario', keywords: 'stock almacen sku producto', icon: <Package size={16} /> },
  { href: '/dashboard/presupuesto', label: 'Presupuesto Anual', keywords: 'budget presupuesto anual mensual', icon: <Wallet size={16} /> },
  { href: '/dashboard/escenarios', label: 'Supuestos & Escenarios', keywords: 'escenario simulacion what if stress', icon: <SlidersHorizontal size={16} /> },
  { href: '/dashboard/variance', label: 'Variance Analysis', keywords: 'varianza desviacion real budget', icon: <TrendingDown size={16} /> },
  { href: '/dashboard/ratios', label: 'Ratios Financieros', keywords: 'ratio roe roa liquidez solvencia', icon: <BarChart3 size={16} /> },
  { href: '/dashboard/notificaciones', label: 'Centro de Alertas', keywords: 'alerta notificacion aviso', icon: <Bell size={16} /> },
  { href: '/dashboard/usuarios', label: 'Gestión de Usuarios', keywords: 'usuario user admin permisos', icon: <Users size={16} /> },
  { href: '/dashboard/configuracion', label: 'Configuración', keywords: 'config ajustes settings parametros', icon: <Settings size={16} /> },
  { href: '/dashboard/importar', label: 'Importar Datos', keywords: 'importar csv excel cargar subir', icon: <Upload size={16} /> },
  { href: '/dashboard/gobierno', label: 'Gobierno del Dato', keywords: 'gobierno dato fuente calidad', icon: <FolderOpen size={16} /> },
  { href: '/dashboard/auditoria', label: 'Auditoría', keywords: 'auditoria audit log registro actividad traza', icon: <ClipboardList size={16} /> },
  { href: '/dashboard/bot', label: 'Bot CFO', keywords: 'bot ia chat asistente pregunta', icon: <Bot size={16} /> },
  { href: '/dashboard/boardpack', label: 'Board Pack', keywords: 'board pack informe consejo', icon: <FileText size={16} /> },
  { href: '/dashboard/reporting', label: 'Reporting', keywords: 'reporte enviar email programar', icon: <Send size={16} /> },
]

const KPI_SHORTCUTS: { label: string; value: string; href: string; keywords: string; icon: React.ReactNode }[] = [
  { label: 'DSO — Dias de cobro', value: 'DSO', href: '/dashboard/cockpit', keywords: 'dso dias cobro days sales outstanding', icon: <Clock size={16} /> },
  { label: 'DPO — Dias de pago', value: 'DPO', href: '/dashboard/cockpit', keywords: 'dpo dias pago days payable', icon: <Clock size={16} /> },
  { label: 'CCC — Ciclo de conversion', value: 'CCC', href: '/dashboard/cockpit', keywords: 'ccc ciclo conversion cash', icon: <TrendingUp size={16} /> },
  { label: 'EBITDA', value: 'EBITDA', href: '/dashboard/presupuesto', keywords: 'ebitda margen beneficio profit', icon: <BarChart3 size={16} /> },
  { label: 'Ratio de liquidez', value: 'Liquidez', href: '/dashboard/cockpit', keywords: 'liquidez ratio current solvencia', icon: <Gauge size={16} /> },
  { label: 'Deuda neta', value: 'Deuda Neta', href: '/dashboard/deuda', keywords: 'deuda neta net debt apalancamiento', icon: <Landmark size={16} /> },
  { label: 'Working Capital', value: 'Working Capital', href: '/dashboard/cockpit', keywords: 'working capital fondo maniobra', icon: <Wallet size={16} /> },
  { label: 'Forecast confianza', value: 'Forecast', href: '/dashboard/forecast', keywords: 'forecast confianza confidence prediccion', icon: <Target size={16} /> },
]

const RECENTLY_VISITED_KEY = 'geacfo-recent-pages'
const MAX_RECENT = 5

function getRecentlyVisited(): { href: string; label: string; timestamp: number }[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENTLY_VISITED_KEY) || '[]')
  } catch { return [] }
}

function addRecentlyVisited(href: string, label: string) {
  if (typeof window === 'undefined') return
  try {
    const recent = getRecentlyVisited().filter(r => r.href !== href)
    recent.unshift({ href, label, timestamp: Date.now() })
    localStorage.setItem(RECENTLY_VISITED_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch { /* ignore */ }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const trapRef = useFocusTrap<HTMLDivElement>(open, false) // false: we manage focus ourselves (inputRef)
  const router = useRouter()

  const QUICK_ACTIONS: { label: string; keywords: string; icon: React.ReactNode; action: () => void }[] = useMemo(() => [
    { label: 'Exportar CSV de tesoreria', keywords: 'exportar csv tesoreria export treasury', icon: <Download size={16} />, action: () => { router.push('/dashboard/cockpit') } },
    { label: 'Nuevo proveedor', keywords: 'nuevo proveedor crear supplier new', icon: <Plus size={16} />, action: () => { router.push('/dashboard/proveedores') } },
    { label: 'Importar datos', keywords: 'importar datos import excel csv upload', icon: <Upload size={16} />, action: () => { router.push('/dashboard/importar') } },
    { label: 'Ver alertas activas', keywords: 'alertas notificaciones alerts warnings', icon: <Bell size={16} />, action: () => { router.push('/dashboard/notificaciones') } },
  ], [router])

  const { data: customersData, isLoading: customersLoading } = useCustomers()
  const { data: arData, isLoading: arLoading } = useAR()
  const { data: apData, isLoading: apLoading } = useAP()
  const { data: suppliersData, isLoading: suppliersLoading } = useSuppliers()

  const loading = customersLoading || arLoading || apLoading || suppliersLoading

  const entityCache = useMemo(() => {
    if (!customersData && !arData && !apData && !suppliersData) return null
    return {
      customers: customersData || [],
      invoicesAR: arData || [],
      invoicesAP: apData || [],
      suppliers: suppliersData || [],
    }
  }, [customersData, arData, apData, suppliersData])

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search
  const search = useCallback((q: string) => {
    const query = q.toLowerCase().trim()
    if (!query) {
      // Show recently visited first, then popular pages
      const recent = getRecentlyVisited()
      const recentResults: SearchResult[] = recent.map(r => {
        const page = PAGES.find(p => p.href === r.href)
        return {
          id: `recent-${r.href}`, type: 'page' as const, title: page?.label || r.label,
          description: 'Reciente', icon: page?.icon || <LayoutDashboard size={16} />, href: r.href,
        }
      })
      const recentHrefs = new Set(recent.map(r => r.href))
      const defaultPages = PAGES.filter(p => !recentHrefs.has(p.href)).slice(0, Math.max(0, 6 - recentResults.length)).map(p => ({
        id: p.href, type: 'page' as const, title: p.label, description: 'Pagina', icon: p.icon, href: p.href,
      }))
      setResults([...recentResults, ...defaultPages])
      return
    }

    const matches: SearchResult[] = []

    // Pages
    PAGES.forEach(p => {
      const searchable = `${p.label} ${p.keywords}`.toLowerCase()
      if (searchable.includes(query)) {
        matches.push({ id: p.href, type: 'page', title: p.label, description: 'Pagina', icon: p.icon, href: p.href })
      }
    })

    // KPI shortcuts
    KPI_SHORTCUTS.forEach(k => {
      if (k.label.toLowerCase().includes(query) || k.keywords.toLowerCase().includes(query)) {
        matches.push({
          id: `kpi-${k.value}`, type: 'kpi', title: k.label, description: k.value, icon: k.icon, href: k.href,
        })
      }
    })

    // Quick actions
    if (query.length >= 2) {
      QUICK_ACTIONS.forEach(a => {
        if (a.label.toLowerCase().includes(query) || a.keywords.toLowerCase().includes(query)) {
          matches.push({
            id: `qaction-${a.label}`, type: 'action', title: a.label, description: '', icon: a.icon, action: a.action,
          })
        }
      })
    }

    // Entities from cache
    if (entityCache) {
      // Customers
      entityCache.customers.forEach(c => {
        if (`${c.name} ${c.code} ${c.nif || ''}`.toLowerCase().includes(query)) {
          matches.push({
            id: `cust-${c.id}`, type: 'customer', title: c.name,
            description: `${c.code} · Score: ${c.creditScore || 'N/A'} · ${c.riskLevel}`,
            icon: <ShieldAlert size={16} />, href: '/dashboard/scoring',
          })
        }
      })

      // Suppliers
      entityCache.suppliers.forEach(s => {
        if (`${s.name} ${s.code} ${s.nif || ''}`.toLowerCase().includes(query)) {
          matches.push({
            id: `supp-${s.id}`, type: 'supplier', title: s.name,
            description: `${s.code} · Proveedor`,
            icon: <Truck size={16} />, href: '/dashboard/proveedores',
          })
        }
      })

      // Invoices AR
      entityCache.invoicesAR.forEach((i: any) => {
        if (`${i.number} ${i.customer?.name || ''}`.toLowerCase().includes(query)) {
          matches.push({
            id: `ar-${i.id}`, type: 'invoice_ar', title: `Factura ${i.number}`,
            description: `${i.customer?.name || ''} · ${fmtEur(Number(i.totalAmount))} · ${i.status}`,
            icon: <ArrowDownToLine size={16} />, href: '/dashboard/cobros',
          })
        }
      })

      // Invoices AP
      entityCache.invoicesAP.forEach((i: any) => {
        if (`${i.number} ${i.supplier?.name || ''}`.toLowerCase().includes(query)) {
          matches.push({
            id: `ap-${i.id}`, type: 'invoice_ap', title: `Factura ${i.number}`,
            description: `${i.supplier?.name || ''} · ${fmtEur(Number(i.totalAmount))} · ${i.status}`,
            icon: <ArrowUpFromLine size={16} />, href: '/dashboard/pagos',
          })
        }
      })
    }

    // Logout action
    if ('cerrar sesion logout salir'.includes(query)) {
      matches.push({ id: 'action-logout', type: 'action', title: 'Cerrar Sesion', description: 'Salir de GEACFO', icon: <Settings size={16} />, action: () => { window.location.href = '/auth/login' } })
    }

    setResults(matches.slice(0, 15))
    setSelected(0)
  }, [entityCache, QUICK_ACTIONS])

  useEffect(() => { search(query) }, [query, search])

  function execute(result: SearchResult) {
    setOpen(false)
    if (result.action) {
      result.action()
    } else if (result.href) {
      addRecentlyVisited(result.href, result.title)
      router.push(result.href)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[selected]) { e.preventDefault(); execute(results[selected]) }
  }

  if (!open) return null

  const TYPE_LABELS: Record<string, string> = {
    page: 'Pagina', customer: 'Cliente', invoice_ar: 'Factura Cobro', invoice_ap: 'Factura Pago', supplier: 'Proveedor', action: 'Accion', kpi: 'KPI',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[200] backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Buscador global" className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[560px] z-[201]">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search size={18} className="text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar paginas, KPIs, facturas, acciones..."
              className="flex-1 py-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto py-2">
            {loading && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">Cargando datos...</div>
            )}
            {!loading && results.length === 0 && query && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">Sin resultados para &quot;{query}&quot;</div>
            )}
            {!loading && results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => execute(r)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50'
                }`}
              >
                <span className={`flex-shrink-0 ${i === selected ? 'text-primary' : 'text-muted-foreground'}`}>{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.description}</div>
                </div>
                <span className={`text-[10px] flex-shrink-0 rounded px-1.5 py-0.5 ${
                  r.type === 'kpi' ? 'bg-amber-500/15 text-amber-400 font-medium' :
                  r.type === 'action' ? 'bg-blue-500/15 text-blue-400 font-medium' :
                  'text-muted-foreground'
                }`}>{TYPE_LABELS[r.type]}</span>
                {i === selected && (
                  <kbd className="hidden sm:inline-flex h-4 items-center rounded bg-muted px-1 text-[9px] text-muted-foreground font-mono flex-shrink-0">↵</kbd>
                )}
              </button>
            ))}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="inline-flex h-4 items-center rounded bg-muted px-1 font-mono">↑↓</kbd> navegar</span>
            <span className="flex items-center gap-1"><kbd className="inline-flex h-4 items-center rounded bg-muted px-1 font-mono">↵</kbd> abrir</span>
            <span className="flex items-center gap-1"><kbd className="inline-flex h-4 items-center rounded bg-muted px-1 font-mono">esc</kbd> cerrar</span>
          </div>
        </div>
      </div>
    </>
  )
}
