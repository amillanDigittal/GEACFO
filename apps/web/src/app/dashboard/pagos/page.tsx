'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt, fmtPct, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Zap, CheckCircle2, Calculator, TrendingUp, TrendingDown, Clock, FileDown } from 'lucide-react'
import { exportPagosPDF } from '@/lib/export-pdf-modules'
import { DateRangeSelector, type DateRange, compareValues } from '@/components/date-range-selector'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { Input } from '@/components/ui/input'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' }> = {
  IN_REVIEW: { label: 'En revisión', variant: 'warning' },
  APPROVED: { label: 'Aprobada', variant: 'success' },
  PAID: { label: 'Pagada', variant: 'secondary' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
}

const priorityConfig: Record<string, { label: string; variant: 'destructive' | 'warning' | 'secondary' }> = {
  HIGH: { label: 'Alta', variant: 'destructive' },
  NORMAL: { label: 'Normal', variant: 'secondary' },
  LOW: { label: 'Baja', variant: 'secondary' },
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function PagosPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'dueDate' | 'totalAmount'>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState(false)
  const [discountRate, setDiscountRate] = useState(2)
  const [page, setPage] = useState(0)
  const [discountDays, setDiscountDays] = useState(10)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [prevInvoices, setPrevInvoices] = useState<any[] | null>(null)
  const [periodLabel, setPeriodLabel] = useState<{ current: string; previous: string } | null>(null)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()
  const { toast } = useToast()

  useEffect(() => {
    api.treasury.ap()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  async function refresh() {
    try {
      const result = await api.treasury.ap(dateFrom, dateTo)
      setInvoices(result)
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
  }

  async function handleDateRange(current: DateRange, previous: DateRange | null) {
    setLoading(true)
    try {
      const from = current.from || undefined, to = current.to || undefined
      setDateFrom(from); setDateTo(to)
      const result = await api.treasury.ap(from, to)
      setInvoices(result)
      if (previous?.from) {
        const prev = await api.treasury.ap(previous.from, previous.to)
        setPrevInvoices(prev)
        setPeriodLabel({ current: current.label, previous: previous.label })
      } else { setPrevInvoices(null); setPeriodLabel(null) }
    } catch (err) { console.error(err) }
    finally { setLoading(false); setLastUpdated(new Date()) }
  }

  if (loading) return <SkeletonKPIsAndTable cols={7} rows={6} />

  const filtered = invoices
    .filter((i: any) => filter === 'ALL' || i.status === filter)
    .sort((a: any, b: any) => {
      if (sortBy === 'dueDate') {
        const da = new Date(a.dueDate).getTime(), db = new Date(b.dueDate).getTime()
        return sortDir === 'asc' ? da - db : db - da
      }
      return sortDir === 'desc' ? Number(b.totalAmount) - Number(a.totalAmount) : Number(a.totalAmount) - Number(b.totalAmount)
    })

  const totalPending = invoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const dueThisWeek = invoices.filter(i => { const d = daysUntil(i.dueDate); return d >= 0 && d <= 7 })
  const dueThisWeekAmount = dueThisWeek.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const approvedCount = invoices.filter(i => i.status === 'APPROVED').length
  const reviewCount = invoices.filter(i => i.status === 'IN_REVIEW').length
  const highPriority = invoices.filter(i => i.priority === 'HIGH')

  // By supplier
  const bySupplier: Record<string, { name: string; code: string; terms: number; total: number; count: number }> = {}
  invoices.forEach(i => {
    const s = i.supplier
    if (!bySupplier[s.id]) bySupplier[s.id] = { name: s.name, code: s.code, terms: s.paymentTerms, total: 0, count: 0 }
    bySupplier[s.id].total += Number(i.totalAmount) - Number(i.paidAmount)
    bySupplier[s.id].count++
  })

  // Payment calendar (next 4 weeks)
  const calendar: { week: string; amount: number; count: number; invoices: any[] }[] = []
  for (let w = 0; w < 4; w++) {
    const start = w * 7
    const end = (w + 1) * 7
    const weekInvoices = invoices.filter(i => {
      const d = daysUntil(i.dueDate)
      return d >= start && d < end
    })
    calendar.push({
      week: w === 0 ? 'Esta semana' : w === 1 ? 'Próxima semana' : `Semana +${w + 1}`,
      amount: weekInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0),
      count: weekInvoices.length,
      invoices: weekInvoices,
    })
  }

  function handleSort(col: 'dueDate' | 'totalAmount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir(col === 'dueDate' ? 'asc' : 'desc') }
  }
  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const reviewInvoices = filtered.filter((i: any) => i.status === 'IN_REVIEW')

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (reviewInvoices.every((i: any) => selected.has(i.id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(reviewInvoices.map((i: any) => i.id)))
    }
  }

  async function handleApprove(id: string) {
    try {
      await api.treasury.approveAP(id)
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
      const updated = await api.treasury.ap()
      setInvoices(updated)
    } catch (e) { console.error(e) }
  }

  async function handleApproveBatch() {
    const ids = [...selected]
    if (ids.length === 0) return
    setApproving(true)
    try {
      if (ids.length === 1) {
        await api.treasury.approveAP(ids[0])
      } else {
        await api.treasury.approveAPBatch(ids)
      }
      toast({ title: 'Facturas aprobadas', description: `${ids.length} factura${ids.length > 1 ? 's' : ''} aprobada${ids.length > 1 ? 's' : ''}` })
      setSelected(new Set())
      const updated = await api.treasury.ap()
      setInvoices(updated)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Cuentas por Pagar"
        subtitle={`Grupo Ibérico SA · ${invoices.length} facturas · Marzo 2026`}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <div className="flex gap-2">
            <DateRangeSelector onChange={handleDateRange} />
            <Button variant="outline" size="sm" onClick={() => exportPagosPDF(invoices)}><FileDown size={14} className="mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV('cuentas_por_pagar', ['Factura', 'Proveedor', 'Vencimiento', 'Base', 'Total', 'Prioridad', 'Estado'], invoices.map((i: any) => [i.number, i.supplier?.name, i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), i.priority, i.status]))}><Download size={14} className="mr-1" />CSV</Button>
          </div>
        }
      />

      {/* Alertas */}
      {highPriority.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <Zap size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{highPriority.length} pago{highPriority.length > 1 ? 's' : ''} de prioridad alta pendiente{highPriority.length > 1 ? 's' : ''}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {highPriority.map(i => `${i.number} — ${i.supplier.name} (${fmtEur(Number(i.totalAmount))})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Period comparison */}
      {prevInvoices && periodLabel && (() => {
        const prevPending = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
        const prevTotal = prevInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
        const curTotal = invoices.reduce((s: number, i: any) => s + Number(i.totalAmount), 0)
        const cmpTotal = compareValues(curTotal, prevTotal)
        const cmpPending = compareValues(totalPending, prevPending)
        const cmpCount = compareValues(invoices.length, prevInvoices.length)
        return (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Facturas', cur: fmtEur(curTotal), prev: fmtEur(prevTotal), ...cmpTotal },
              { label: 'Pendiente Pago', cur: fmtEur(totalPending), prev: fmtEur(prevPending), ...cmpPending },
              { label: 'Nº Facturas', cur: String(invoices.length), prev: String(prevInvoices.length), ...cmpCount },
            ].map(c => (
              <div key={c.label} className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{c.label}</div>
                <div className="flex items-end justify-between mt-1">
                  <div>
                    <div className="font-mono text-lg font-bold">{c.cur}</div>
                    <div className="text-[10px] text-muted-foreground">vs {c.prev} ({periodLabel.previous})</div>
                  </div>
                  <div className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${c.positive ? 'text-success' : 'text-destructive'}`}>
                    {c.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {c.pct > 0 ? '+' : ''}{c.pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox label="Total Pendiente" value={fmtEur(totalPending)} tooltip="Suma de importes pendientes de pago a proveedores." source="Facturas AP (totalAmount − paidAmount)" />
        <KpiBox label="Vence Esta Semana" value={fmtEur(dueThisWeekAmount)} color={dueThisWeekAmount > 0 ? 'text-warning' : 'text-success'} tooltip="Importe de pagos que vencen en los próximos 7 días. Impacto directo en tesorería a corto plazo." source="Facturas AP con dueDate ≤ 7 días" />
        <KpiBox label="Aprobadas" value={`${approvedCount}`} color="text-success" tooltip="Facturas ya aprobadas y listas para ejecución de pago." source="Facturas AP con status APPROVED" />
        <KpiBox label="En Revisión" value={`${reviewCount}`} color={reviewCount > 0 ? 'text-warning' : 'text-foreground'} tooltip="Facturas pendientes de aprobación por el CFO o controller." source="Facturas AP con status IN_REVIEW" />
      </div>

      {/* Calendar + By Supplier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment calendar */}
        <Card>
          <CardHeader><CardTitle>Calendario de Pagos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {calendar.map(w => {
              const pct = totalPending > 0 ? (w.amount / totalPending) * 100 : 0
              const isUrgent = w.week === 'Esta semana' && w.amount > 0
              return (
                <div key={w.week}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`font-medium ${isUrgent ? 'text-warning' : ''}`}>
                      {w.week} {isUrgent && <Zap size={12} className="inline" />} <span className="text-muted-foreground">({w.count} fact.)</span>
                    </span>
                    <span className={`font-mono font-semibold ${isUrgent ? 'text-warning' : 'text-foreground'}`}>
                      {w.amount > 0 ? fmtEur(w.amount) : '—'}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${pct}%`,
                      background: isUrgent ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
                    }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* By Supplier */}
        <Card>
          <CardHeader><CardTitle>Por Proveedor</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.values(bySupplier)
              .sort((a, b) => b.total - a.total)
              .map(s => {
                const pct = totalPending > 0 ? (s.total / totalPending) * 100 : 0
                return (
                  <div key={s.code} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        <Badge variant="secondary">{s.code}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{s.count} factura{s.count > 1 ? 's' : ''} · Plazo: {s.terms}d</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-xs font-semibold">{fmtEur(s.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      </div>

      {/* Descuento por pronto pago */}
      {(() => {
        const unpaid = invoices.filter(i => i.status !== 'PAID' && i.status !== 'REJECTED')
        const eligible = unpaid
          .map(inv => {
            const days = daysUntil(inv.dueDate)
            const remaining = Number(inv.totalAmount) - Number(inv.paidAmount)
            const termsD = inv.supplier.paymentTerms || 30
            const daysEarly = days - discountDays
            if (remaining <= 0 || days < 0 || daysEarly < 0) return null
            const saving = remaining * (discountRate / 100)
            const netPayment = remaining - saving
            // Coste anualizado de NO aprovechar el descuento: (descuento / neto) * (365 / días_que_adelantas)
            const annualizedRate = daysEarly > 0 ? (saving / netPayment) * (365 / daysEarly) * 100 : 0
            return { ...inv, remaining, saving, netPayment, daysEarly, annualizedRate, termsD }
          })
          .filter(Boolean) as any[]
        const totalSaving = eligible.reduce((s, e) => s + e.saving, 0)
        const totalRemaining = eligible.reduce((s, e) => s + e.remaining, 0)
        const topOpportunities = [...eligible].sort((a, b) => b.saving - a.saving).slice(0, 5)

        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-primary" />
                  <CardTitle>Descuento por Pronto Pago</CardTitle>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Descuento %</label>
                    <Input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.1}
                      value={discountRate}
                      onChange={e => setDiscountRate(parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Si pago en</label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      step={1}
                      value={discountDays}
                      onChange={e => setDiscountDays(parseInt(e.target.value) || 0)}
                      className="w-16 h-8 text-xs font-mono"
                    />
                    <span className="text-xs text-muted-foreground">días</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Facturas Elegibles</div>
                  <div className="font-mono text-lg font-bold">{eligible.length}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Importe Total</div>
                  <div className="font-mono text-lg font-bold">{fmtEur(totalRemaining)}</div>
                </div>
                <div className="bg-success/10 rounded-lg p-3 text-center border border-success/20">
                  <div className="text-[10px] text-success uppercase tracking-widest mb-1">Ahorro Potencial</div>
                  <div className="font-mono text-lg font-bold text-success">{fmtEur(totalSaving)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Términos</div>
                  <div className="font-mono text-lg font-bold">{fmt(discountRate, 1)}/<span className="text-sm">{discountDays}d</span></div>
                </div>
              </div>

              {/* Top oportunidades */}
              {topOpportunities.length > 0 ? (
                <ScrollableTable>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Factura</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Proveedor</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Vencimiento</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Importe</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Ahorro</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Pago Neto</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Días Adelanto</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Tasa Anualizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topOpportunities.map((inv: any) => (
                        <tr key={inv.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                          <td className="p-3 text-sm">{inv.supplier.name}</td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{fmtDate(inv.dueDate)}</td>
                          <td className="p-3 font-mono text-xs">{fmtEur(inv.remaining)}</td>
                          <td className="p-3 font-mono text-xs font-semibold text-success">{fmtEur(inv.saving)}</td>
                          <td className="p-3 font-mono text-xs">{fmtEur(inv.netPayment)}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 font-mono text-xs">
                              <Clock size={12} className="text-muted-foreground" />
                              {inv.daysEarly}d
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${inv.annualizedRate > 20 ? 'text-success' : inv.annualizedRate > 10 ? 'text-warning' : 'text-muted-foreground'}`}>
                              <TrendingUp size={12} />
                              {fmtPct(inv.annualizedRate)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No hay facturas elegibles para descuento con los términos actuales
                </div>
              )}

              {eligible.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                  <TrendingUp size={14} className="text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    Pagando {eligible.length} factura{eligible.length > 1 ? 's' : ''} con términos <strong>{fmt(discountRate, 1)}/{discountDays}</strong> (neto {eligible[0]?.termsD || 30}),
                    el ahorro de <strong className="text-success">{fmtEur(totalSaving)}</strong> equivale a una rentabilidad anualizada media
                    del <strong>{fmtPct(eligible.length > 0 ? eligible.reduce((s, e) => s + e.annualizedRate, 0) / eligible.length : 0)}</strong>.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <CardTitle>Detalle de Facturas</CardTitle>
              {selected.size > 0 && (
                <Button size="sm" onClick={handleApproveBatch} disabled={approving}>
                  <CheckCircle2 size={14} className="mr-1" />
                  {approving ? 'Procesando...' : `Aprobar (${selected.size})`}
                </Button>
              )}
            </div>
            <div className="flex gap-1.5">
              {[
                { key: 'ALL', label: 'Todas' },
                { key: 'IN_REVIEW', label: 'En revisión' },
                { key: 'APPROVED', label: 'Aprobadas' },
                { key: 'PAID', label: 'Pagadas' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setPage(0) }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === f.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 w-8">
                  {reviewInvoices.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las facturas en revisión"
                      className="rounded border-border"
                      checked={reviewInvoices.length > 0 && reviewInvoices.every((i: any) => selected.has(i.id))}
                      onChange={toggleSelectAll}
                    />
                  )}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Factura</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Proveedor</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => handleSort('dueDate')}>
                  Vencimiento{sortIcon('dueDate')}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Base</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => handleSort('totalAmount')}>
                  Total{sortIcon('totalAmount')}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Prioridad</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Estado</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Plazo</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page * 10, (page + 1) * 10).map((inv: any) => {
                const stCfg = statusConfig[inv.status] || statusConfig.IN_REVIEW
                const priCfg = priorityConfig[inv.priority] || priorityConfig.NORMAL
                const days = daysUntil(inv.dueDate)
                const isUrgent = days <= 3 && days >= 0
                const isOverdue = days < 0
                return (
                  <tr key={inv.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${selected.has(inv.id) ? 'bg-primary/5' : isOverdue ? 'bg-destructive/5' : isUrgent ? 'bg-warning/5' : ''}`}>
                    <td className="p-3">
                      {inv.status === 'IN_REVIEW' && (
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar factura ${inv.number}`}
                          className="rounded border-border"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                        />
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                    <td className="p-3">
                      <div className="font-medium text-sm">{inv.supplier.name}</div>
                      <div className="text-xs text-muted-foreground">{inv.supplier.code}</div>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-mono ${isOverdue ? 'text-destructive font-semibold' : isUrgent ? 'text-warning font-semibold' : 'text-muted-foreground'}`}>
                        {fmtDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{fmtEur(Number(inv.amount))}</td>
                    <td className="p-3 font-mono text-xs font-semibold">{fmtEur(Number(inv.totalAmount))}</td>
                    <td className="p-3"><Badge variant={priCfg.variant}>{priCfg.label}</Badge></td>
                    <td className="p-3"><Badge variant={stCfg.variant}>{stCfg.label}</Badge></td>
                    <td className="p-3">
                      {isOverdue ? (
                        <span className="font-mono text-xs font-bold text-destructive">{Math.abs(days)}d vencida</span>
                      ) : (
                        <span className={`font-mono text-xs ${isUrgent ? 'font-bold text-warning' : 'text-muted-foreground'}`}>
                          {days}d {isUrgent && <Zap size={12} className="inline" />}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {inv.status === 'IN_REVIEW' && (
                        <Button variant="outline" size="sm" onClick={() => handleApprove(inv.id)}>
                          Aprobar
                        </Button>
                      )}
                      {inv.status === 'APPROVED' && (
                        <span className="text-xs text-success font-medium">Listo para pago</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
</ScrollableTable>
        {filtered.length > 10 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</Button>
            {Array.from({ length: Math.ceil(filtered.length / 10) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= Math.ceil(filtered.length / 10) - 1} onClick={() => setPage(p => p + 1)}>→</Button>
            <span className="text-xs text-muted-foreground ml-2">{page * 10 + 1}–{Math.min((page + 1) * 10, filtered.length)} de {filtered.length}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
