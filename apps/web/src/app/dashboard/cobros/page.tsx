'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt, riskLabel, riskVariant, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Siren, ChevronDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  OVERDUE: { label: 'Vencida', variant: 'destructive' },
  PAID: { label: 'Pagada', variant: 'success' },
  PARTIAL: { label: 'Parcial', variant: 'secondary' },
}

function daysDiff(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function agingBucket(dueDate: string): string {
  const days = daysDiff(dueDate)
  if (days < 0) return 'Al día'
  if (days <= 30) return '1-30d'
  if (days <= 60) return '31-60d'
  if (days <= 90) return '61-90d'
  return '>90d'
}

export default function CobrosPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'dueDate' | 'totalAmount'>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  useEffect(() => {
    api.treasury.ar()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  async function refresh() {
    try {
      const result = await api.treasury.ar()
      setInvoices(result)
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
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
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE')
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const pendingCount = invoices.filter(i => i.status === 'PENDING').length
  const overdueCount = overdueInvoices.length

  // Aging buckets
  const buckets: Record<string, { count: number; amount: number }> = {}
  invoices.forEach(i => {
    if (i.status === 'PAID') return
    const bucket = agingBucket(i.dueDate)
    if (!buckets[bucket]) buckets[bucket] = { count: 0, amount: 0 }
    buckets[bucket].count++
    buckets[bucket].amount += Number(i.totalAmount) - Number(i.paidAmount)
  })

  // By customer
  const byCustomer: Record<string, { name: string; code: string; score: number; risk: string; total: number; count: number }> = {}
  invoices.forEach(i => {
    const c = i.customer
    if (!byCustomer[c.id]) byCustomer[c.id] = { name: c.name, code: c.code, score: c.creditScore, risk: c.riskLevel, total: 0, count: 0 }
    byCustomer[c.id].total += Number(i.totalAmount) - Number(i.paidAmount)
    byCustomer[c.id].count++
  })

  function handleSort(col: 'dueDate' | 'totalAmount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir(col === 'dueDate' ? 'asc' : 'desc') }
  }
  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Cuentas por Cobrar"
        subtitle={`Grupo Ibérico SA · ${invoices.length} facturas · Marzo 2026`}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCSV('cuentas_por_cobrar', ['Factura', 'Cliente', 'Emisión', 'Vencimiento', 'Base', 'Total', 'Pagado', 'Estado'], invoices.map((i: any) => [i.number, i.customer?.name, i.issueDate?.slice(0, 10), i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), Number(i.paidAmount), i.status]))}><Download size={14} className="mr-1" />Exportar</Button>
        }
      />

      {/* Alerta vencidas */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{overdueCount} factura{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''} — {fmtEur(totalOverdue)}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {overdueInvoices.map(i => `${i.number} (${i.customer.name})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox label="Total Pendiente" value={fmtEur(totalPending)} tooltip="Suma de importes pendientes de cobro de todas las facturas activas." source="Facturas AR (totalAmount − paidAmount)" />
        <KpiBox label="Vencido" value={fmtEur(totalOverdue)} color={totalOverdue > 0 ? 'text-destructive' : 'text-success'} tooltip="Importe total de facturas que han superado su fecha de vencimiento sin cobrar." source="Facturas AR con status OVERDUE" />
        <KpiBox label="Facturas Pendientes" value={`${pendingCount + overdueCount}`} tooltip="Número de facturas no cobradas, incluyendo pendientes y vencidas." source="Facturas AR (PENDING + OVERDUE)" />
        <KpiBox label="DSO Medio" value={`${Math.round(invoices.reduce((s, i) => s + (i.customer?.dso || 0), 0) / (invoices.length || 1))}d`} tooltip="Days Sales Outstanding medio de la cartera. Promedio ponderado del plazo de cobro por cliente." source="DSO por cliente (modelo Customer)" />
      </div>

      {/* Aging Report interactivo */}
      {(() => {
        const BUCKET_ORDER = ['Al día', '1-30d', '31-60d', '61-90d', '>90d']
        const BUCKET_COLORS: Record<string, string> = {
          'Al día': 'hsl(var(--success))',
          '1-30d': 'hsl(var(--primary))',
          '31-60d': 'hsl(var(--warning))',
          '61-90d': 'hsl(210, 60%, 55%)',
          '>90d': 'hsl(var(--destructive))',
        }

        // Aging by customer (for stacked chart)
        const customerNames = [...new Set(invoices.filter(i => i.status !== 'PAID').map(i => i.customer.name))]
        const agingByCustomer = BUCKET_ORDER.map(bucket => {
          const entry: any = { bucket }
          customerNames.forEach(name => { entry[name] = 0 })
          invoices.forEach(i => {
            if (i.status === 'PAID') return
            if (agingBucket(i.dueDate) === bucket) {
              entry[i.customer.name] = (entry[i.customer.name] || 0) + Number(i.totalAmount) - Number(i.paidAmount)
            }
          })
          return entry
        })

        // Chart data for simple bar
        const chartData = BUCKET_ORDER.map(bucket => ({
          bucket,
          amount: buckets[bucket]?.amount || 0,
          count: buckets[bucket]?.count || 0,
          color: BUCKET_COLORS[bucket],
        }))

        // Pie data
        const pieData = BUCKET_ORDER.filter(b => buckets[b]?.amount > 0).map(bucket => ({
          name: bucket,
          value: Math.round(buckets[bucket]?.amount || 0),
          fill: BUCKET_COLORS[bucket],
        }))

        // Invoices for selected bucket
        const bucketInvoices = selectedBucket
          ? invoices.filter(i => i.status !== 'PAID' && agingBucket(i.dueDate) === selectedBucket)
              .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount))
          : []

        return (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bar chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <CardTitle>Aging Report — Antigüedad de Saldos</CardTitle>
                    {selectedBucket && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedBucket(null)}>
                        Limpiar selección
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [fmtEur(v), 'Importe']}
                        labelFormatter={l => `Tramo: ${l}`}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(data: any) => setSelectedBucket(data.bucket === selectedBucket ? null : data.bucket)}>
                        {chartData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.color}
                            opacity={selectedBucket && selectedBucket !== entry.bucket ? 0.3 : 1}
                            stroke={selectedBucket === entry.bucket ? 'hsl(var(--foreground))' : 'none'}
                            strokeWidth={selectedBucket === entry.bucket ? 2 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Bucket summary row */}
                  <div className="flex gap-2 mt-3">
                    {BUCKET_ORDER.map(bucket => {
                      const b = buckets[bucket]
                      const isActive = selectedBucket === bucket
                      return (
                        <button
                          key={bucket}
                          onClick={() => setSelectedBucket(isActive ? null : bucket)}
                          className={`flex-1 p-2 rounded-lg border text-center transition-all ${isActive ? 'border-foreground bg-muted' : 'border-border hover:border-foreground/30'}`}
                        >
                          <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: BUCKET_COLORS[bucket] }} />
                          <div className="text-[10px] text-muted-foreground">{bucket}</div>
                          <div className="font-mono text-xs font-bold">{b ? fmtEur(b.amount) : '—'}</div>
                          <div className="text-[9px] text-muted-foreground">{b ? `${b.count} fact.` : '0'}</div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Pie + Customer exposure */}
              <Card>
                <CardHeader><CardTitle>Distribución</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                          onClick={(data: any) => setSelectedBucket(data.name === selectedBucket ? null : data.name)}
                          cursor="pointer"
                        >
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} opacity={selectedBucket && selectedBucket !== entry.name ? 0.3 : 1} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number) => [fmtEur(v), 'Importe']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                  )}
                  {/* By customer */}
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-3 mb-2">Por Cliente</div>
                  <div className="space-y-2">
                    {Object.values(byCustomer)
                      .sort((a, b) => b.total - a.total)
                      .map(c => {
                        const pct = totalPending > 0 ? (c.total / totalPending) * 100 : 0
                        return (
                          <div key={c.code} className="flex items-center gap-2 text-xs">
                            <Badge variant={riskVariant(c.risk)} className="text-[9px]">{riskLabel(c.risk)}</Badge>
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="font-mono font-semibold">{fmtEur(c.total)}</span>
                            <span className="text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Drill-down: selected bucket invoices */}
            {selectedBucket && bucketInvoices.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: BUCKET_COLORS[selectedBucket] }} />
                      <CardTitle>Facturas — Tramo {selectedBucket}</CardTitle>
                      <Badge variant="secondary">{bucketInvoices.length} factura{bucketInvoices.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {fmtEur(bucketInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0))}
                    </span>
                  </div>
                </CardHeader>
                <ScrollableTable>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Factura', 'Cliente', 'Vencimiento', 'Días', 'Pendiente', 'Estado'].map(h => (
                          <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bucketInvoices.map(inv => {
                        const days = daysDiff(inv.dueDate)
                        const pending = Number(inv.totalAmount) - Number(inv.paidAmount)
                        const cfg = statusConfig[inv.status] || statusConfig.PENDING
                        return (
                          <tr key={inv.id} className="border-b border-border hover:bg-muted/50">
                            <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                            <td className="p-3">
                              <div className="text-sm font-medium">{inv.customer.name}</div>
                              <div className="text-xs text-muted-foreground">{inv.customer.code} · Score: {inv.customer.creditScore}</div>
                            </td>
                            <td className="p-3 font-mono text-xs text-muted-foreground">{fmtDate(inv.dueDate)}</td>
                            <td className="p-3">
                              <span className={`font-mono text-xs font-bold ${days > 60 ? 'text-destructive' : days > 0 ? 'text-warning' : 'text-success'}`}>
                                {days > 0 ? `${days}d vencida` : days === 0 ? 'Hoy' : `${Math.abs(days)}d restantes`}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-xs font-semibold">{fmtEur(pending)}</td>
                            <td className="p-3"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </ScrollableTable>
              </Card>
            )}
          </>
        )
      })()}

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Detalle de Facturas</CardTitle>
            <div className="flex gap-1.5">
              {[
                { key: 'ALL', label: 'Todas' },
                { key: 'OVERDUE', label: 'Vencidas' },
                { key: 'PENDING', label: 'Pendientes' },
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
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Factura</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Cliente</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Emisión</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => handleSort('dueDate')}>
                  Vencimiento{sortIcon('dueDate')}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Base</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => handleSort('totalAmount')}>
                  Total{sortIcon('totalAmount')}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Pagado</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Estado</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Antigüedad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page * 10, (page + 1) * 10).map((inv: any) => {
                const cfg = statusConfig[inv.status] || statusConfig.PENDING
                const pending = Number(inv.totalAmount) - Number(inv.paidAmount)
                const overdueDays = inv.status === 'OVERDUE' ? daysDiff(inv.dueDate) : 0
                return (
                  <tr key={inv.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${inv.status === 'OVERDUE' ? 'bg-destructive/5' : ''}`}>
                    <td className="p-3 font-mono text-xs font-semibold">{inv.number}</td>
                    <td className="p-3">
                      <div className="font-medium text-sm">{inv.customer.name}</div>
                      <div className="text-xs text-muted-foreground">{inv.customer.code}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{fmtDate(inv.issueDate)}</td>
                    <td className="p-3">
                      <span className={`text-xs font-mono ${inv.status === 'OVERDUE' ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        {fmtDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{fmtEur(Number(inv.amount))}</td>
                    <td className="p-3 font-mono text-xs font-semibold">{fmtEur(Number(inv.totalAmount))}</td>
                    <td className="p-3 font-mono text-xs">
                      {Number(inv.paidAmount) > 0 ? (
                        <span className="text-success">{fmtEur(Number(inv.paidAmount))}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    <td className="p-3">
                      {inv.status === 'OVERDUE' ? (
                        <span className="font-mono text-xs font-bold text-destructive">{overdueDays}d vencida</span>
                      ) : inv.status === 'PENDING' ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {daysDiff(inv.dueDate) < 0 ? `${Math.abs(daysDiff(inv.dueDate))}d restantes` : 'Hoy'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
