'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt, riskLabel, riskVariant, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Siren } from 'lucide-react'
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

  useEffect(() => {
    api.treasury.ar()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Cuentas por Cobrar</h1>
          <p className="page-subtitle">Grupo Ibérico SA · {invoices.length} facturas · Marzo 2026</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV('cuentas_por_cobrar', ['Factura', 'Cliente', 'Emisión', 'Vencimiento', 'Base', 'Total', 'Pagado', 'Estado'], invoices.map((i: any) => [i.number, i.customer?.name, i.issueDate?.slice(0, 10), i.dueDate?.slice(0, 10), Number(i.amount), Number(i.totalAmount), Number(i.paidAmount), i.status]))}><Download size={14} className="mr-1" />Exportar</Button>
      </div>

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
        {[
          { label: 'Total Pendiente', value: fmtEur(totalPending), color: 'text-foreground' },
          { label: 'Vencido', value: fmtEur(totalOverdue), color: totalOverdue > 0 ? 'text-destructive' : 'text-success' },
          { label: 'Facturas Pendientes', value: `${pendingCount + overdueCount}`, color: 'text-foreground' },
          { label: 'DSO Medio', value: `${Math.round(invoices.reduce((s, i) => s + (i.customer?.dso || 0), 0) / (invoices.length || 1))}d`, color: 'text-foreground' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Aging + By Customer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aging */}
        <Card>
          <CardHeader><CardTitle>Antigüedad de Saldos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {['Al día', '1-30d', '31-60d', '61-90d', '>90d'].map(bucket => {
              const b = buckets[bucket]
              if (!b) return (
                <div key={bucket} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-xs text-muted-foreground">{bucket}</span>
                  <span className="font-mono text-xs text-muted-foreground">—</span>
                </div>
              )
              const isOld = bucket === '61-90d' || bucket === '>90d'
              const pct = totalPending > 0 ? (b.amount / totalPending) * 100 : 0
              return (
                <div key={bucket}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{bucket} <span className="text-muted-foreground">({b.count} fact.)</span></span>
                    <span className={`font-mono font-semibold ${isOld ? 'text-destructive' : 'text-foreground'}`}>{fmtEur(b.amount)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isOld ? 'hsl(var(--destructive))' : bucket === '1-30d' || bucket === '31-60d' ? 'hsl(var(--warning))' : 'hsl(var(--success))' }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* By Customer */}
        <Card>
          <CardHeader><CardTitle>Exposición por Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.values(byCustomer)
              .sort((a, b) => b.total - a.total)
              .map(c => {
                const pct = totalPending > 0 ? (c.total / totalPending) * 100 : 0
                return (
                  <div key={c.code} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        <Badge variant={riskVariant(c.risk)}>{riskLabel(c.risk)}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{c.count} factura{c.count > 1 ? 's' : ''} · Score: {c.score}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-xs font-semibold">{fmtEur(c.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      </div>

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
                  onClick={() => setFilter(f.key)}
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
              {filtered.map((inv: any) => {
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
      </Card>
    </div>
  )
}
