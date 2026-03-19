'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, TrendingDown } from 'lucide-react'

interface DayProjection {
  date: string
  label: string
  weekday: string
  cobros: number
  pagos: number
  net: number
  balance: number
  cobroInvoices: any[]
  pagoInvoices: any[]
}

export default function ProyeccionDiariaPage() {
  const [arData, setArData] = useState<any[]>([])
  const [apData, setApData] = useState<any[]>([])
  const [cashData, setCashData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayProjection | null>(null)
  const [horizon, setHorizon] = useState(30)

  function fetchData() {
    return Promise.all([
      api.treasury.ar(),
      api.treasury.ap(),
      api.treasury.cockpit(),
    ])
      .then(([ar, ap, cockpit]) => {
        setArData(ar)
        setApData(ap)
        setCashData(cockpit)
        setLastUpdated(new Date())
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  if (loading || !cashData) return <SkeletonKPIsAndTable cols={5} rows={8} />

  const currentCash = cashData.caja?.value || 0
  const today = new Date()

  // Build daily projections
  const days: DayProjection[] = []
  let runningBalance = currentCash

  for (let d = 0; d < horizon; d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d)
    const dateStr = date.toISOString().slice(0, 10)
    const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' })
    const label = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

    // AR invoices due on this day (expected inflows)
    const cobroInvoices = arData.filter(i => {
      if (i.status === 'PAID') return false
      return String(i.dueDate).slice(0, 10) === dateStr
    })
    const cobros = cobroInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)

    // AP invoices due on this day (expected outflows)
    const pagoInvoices = apData.filter(i => {
      if (i.status === 'PAID' || i.status === 'REJECTED') return false
      return String(i.dueDate).slice(0, 10) === dateStr
    })
    const pagos = pagoInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)

    const net = cobros - pagos
    runningBalance += net

    days.push({
      date: dateStr,
      label,
      weekday,
      cobros,
      pagos,
      net,
      balance: runningBalance,
      cobroInvoices,
      pagoInvoices,
    })
  }

  // Key metrics
  const minBalance = Math.min(...days.map(d => d.balance))
  const minDay = days.find(d => d.balance === minBalance)!
  const totalCobros30 = days.reduce((s, d) => s + d.cobros, 0)
  const totalPagos30 = days.reduce((s, d) => s + d.pagos, 0)
  const endBalance = days[days.length - 1]?.balance || currentCash
  const negativeDays = days.filter(d => d.balance < 0)
  const tensionDays = days.filter(d => d.net < -10000)

  // Chart data
  const chartData = days.map(d => ({
    date: d.label,
    weekday: d.weekday,
    Cobros: Math.round(d.cobros),
    Pagos: -Math.round(d.pagos),
    Saldo: Math.round(d.balance),
    hasActivity: d.cobros > 0 || d.pagos > 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyección de Cash Flow Diario"
        subtitle={`Próximos ${horizon} días · Saldo inicial: ${fmtEur(currentCash)}`}
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        actions={
          <div className="flex gap-1">
            {[15, 30, 60].map(h => (
              <button
                key={h}
                onClick={() => { setHorizon(h); setSelectedDay(null) }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${horizon === h ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {h}d
              </button>
            ))}
          </div>
        }
      />

      {/* Alert: negative balance */}
      {negativeDays.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">Saldo negativo proyectado en {negativeDays.length} día{negativeDays.length > 1 ? 's' : ''}</div>
            <div className="text-xs opacity-80 mt-0.5">
              Mínimo: {fmtEur(Math.round(minBalance))} el {new Date(minDay.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}. Requiere acción preventiva.
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiBox label="Saldo Actual" value={fmtEur(currentCash)} tooltip="Saldo consolidado de todas las cuentas bancarias a día de hoy." source="Cuentas bancarias" />
        <KpiBox label="Cobros Esperados" value={`+${fmtEur(Math.round(totalCobros30))}`} color="text-success" tooltip={`Facturas AR que vencen en los próximos ${horizon} días. Importes pendientes de cobro.`} source="Facturas AR (dueDate)" />
        <KpiBox label="Pagos Previstos" value={`−${fmtEur(Math.round(totalPagos30))}`} color="text-destructive" tooltip={`Facturas AP que vencen en los próximos ${horizon} días. Pagos comprometidos.`} source="Facturas AP (dueDate)" />
        <KpiBox label="Saldo Mínimo" value={fmtEur(Math.round(minBalance))} color={minBalance < 0 ? 'text-destructive' : minBalance < currentCash * 0.3 ? 'text-warning' : 'text-success'} tooltip={`Punto más bajo de caja proyectado: ${minDay ? new Date(minDay.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '—'}. Si es negativo, requiere financiación.`} source="Proyección: saldo + cobros − pagos acumulados" />
        <KpiBox label={`Saldo D+${horizon}`} value={fmtEur(Math.round(endBalance))} color={endBalance >= currentCash ? 'text-success' : 'text-warning'} tooltip={`Saldo proyectado al final del horizonte de ${horizon} días.`} source="Proyección acumulada" />
      </div>

      {/* Main chart: Area (balance) + Bars (cobros/pagos) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Proyección de Saldo y Flujos Diarios</CardTitle>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Cobros</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Pagos</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary rounded" /> Saldo</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={horizon <= 15 ? 0 : horizon <= 30 ? 2 : 5} angle={-45} textAnchor="end" height={45} />
              <YAxis yAxisId="balance" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
              <YAxis yAxisId="flows" orientation="right" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => Math.abs(v) >= 1000 ? `${Math.round(Math.abs(v) / 1000)}k` : String(Math.abs(v))} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number, name: string) => {
                  if (name === 'Pagos') return [fmtEur(Math.abs(v)), name]
                  return [fmtEur(v), name]
                }}
              />
              <ReferenceLine yAxisId="balance" y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine yAxisId="balance" y={currentCash} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.3} label={{ value: 'Saldo actual', position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <Bar yAxisId="flows" dataKey="Cobros" fill="hsl(var(--success))" opacity={0.7} radius={[2, 2, 0, 0]} />
              <Bar yAxisId="flows" dataKey="Pagos" fill="hsl(var(--destructive))" opacity={0.7} radius={[0, 0, 2, 2]} />
              <Area yAxisId="balance" type="monotone" dataKey="Saldo" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#balanceGradient)" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily detail table + Minimum point */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>Detalle Diario</CardTitle>
              <span className="text-xs text-muted-foreground">{days.filter(d => d.cobros > 0 || d.pagos > 0).length} días con movimientos</span>
            </div>
          </CardHeader>
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Fecha', 'Cobros', 'Pagos', 'Neto', 'Saldo Proyectado'].map(h => (
                    <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.filter(d => d.cobros > 0 || d.pagos > 0).map(d => {
                  const isMin = d.date === minDay?.date
                  const isNeg = d.balance < 0
                  const isSelected = selectedDay?.date === d.date
                  return (
                    <tr
                      key={d.date}
                      className={`border-b border-border transition-colors cursor-pointer ${isMin ? 'bg-warning/10' : isNeg ? 'bg-destructive/5' : 'hover:bg-muted/50'} ${isSelected ? 'ring-1 ring-inset ring-primary' : ''}`}
                      onClick={() => setSelectedDay(isSelected ? null : d)}
                    >
                      <td className="p-3">
                        <div className="text-xs font-medium">{d.label}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">{d.weekday}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {d.cobros > 0 ? <span className="text-success font-semibold">+{fmtEur(Math.round(d.cobros))}</span> : <span className="text-muted-foreground">—</span>}
                        {d.cobroInvoices.length > 0 && <div className="text-[9px] text-muted-foreground">{d.cobroInvoices.length} fact.</div>}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {d.pagos > 0 ? <span className="text-destructive font-semibold">−{fmtEur(Math.round(d.pagos))}</span> : <span className="text-muted-foreground">—</span>}
                        {d.pagoInvoices.length > 0 && <div className="text-[9px] text-muted-foreground">{d.pagoInvoices.length} fact.</div>}
                      </td>
                      <td className="p-3 font-mono text-xs font-semibold">
                        <span className={d.net >= 0 ? 'text-success' : 'text-destructive'}>
                          {d.net >= 0 ? '+' : ''}{fmtEur(Math.round(d.net))}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs font-bold">
                        <span className={d.balance < 0 ? 'text-destructive' : ''}>
                          {fmtEur(Math.round(d.balance))}
                        </span>
                        {isMin && <Badge variant="warning" className="ml-1 text-[8px]">Mín</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>

        {/* Insight panel */}
        <div className="space-y-4">
          {/* Minimum point card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className={minBalance < 0 ? 'text-destructive' : 'text-warning'} />
                <CardTitle>Punto Mínimo de Caja</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`p-4 rounded-lg border-2 text-center ${minBalance < 0 ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/5'}`}>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Saldo Mínimo Proyectado</div>
                <div className={`font-mono text-2xl font-bold ${minBalance < 0 ? 'text-destructive' : 'text-warning'}`}>{fmtEur(Math.round(minBalance))}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {minDay && new Date(minDay.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Saldo actual</span>
                  <span className="font-mono font-semibold">{fmtEur(currentCash)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Variación hasta mínimo</span>
                  <span className={`font-mono font-semibold ${minBalance - currentCash < 0 ? 'text-destructive' : 'text-success'}`}>{fmtEur(Math.round(minBalance - currentCash))}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Días hasta mínimo</span>
                  <span className="font-mono font-semibold">{minDay ? Math.ceil((new Date(minDay.date).getTime() - today.getTime()) / 86400000) : 0}d</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Saldo final (D+{horizon})</span>
                  <span className="font-mono font-semibold">{fmtEur(Math.round(endBalance))}</span>
                </div>
              </div>
              {minBalance < 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  Se necesitan <strong>{fmtEur(Math.abs(Math.round(minBalance)))}</strong> adicionales para evitar descubierto. Considerar: acelerar cobros, retrasar pagos, o activar línea de crédito.
                </div>
              )}
              {minBalance >= 0 && minBalance < currentCash * 0.2 && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                  El saldo cae un <strong>{Math.round((1 - minBalance / currentCash) * 100)}%</strong> respecto al actual. Monitorizar de cerca y preparar contingencia.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected day detail */}
          {selectedDay && (selectedDay.cobroInvoices.length > 0 || selectedDay.pagoInvoices.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>{new Date(selectedDay.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {selectedDay.cobroInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center gap-2 p-2 rounded-lg bg-success/5 border border-success/20 text-xs">
                    <ArrowDownToLine size={12} className="text-success flex-shrink-0" />
                    <span className="font-mono font-semibold">{inv.number}</span>
                    <span className="flex-1 truncate text-muted-foreground">{inv.customer?.name}</span>
                    <span className="font-mono font-semibold text-success">+{fmtEur(Math.round(Number(inv.totalAmount) - Number(inv.paidAmount)))}</span>
                  </div>
                ))}
                {selectedDay.pagoInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
                    <ArrowUpFromLine size={12} className="text-destructive flex-shrink-0" />
                    <span className="font-mono font-semibold">{inv.number}</span>
                    <span className="flex-1 truncate text-muted-foreground">{inv.supplier?.name}</span>
                    <span className="font-mono font-semibold text-destructive">−{fmtEur(Math.round(Number(inv.totalAmount) - Number(inv.paidAmount)))}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
