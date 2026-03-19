'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmt, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, AlertTriangle, Siren } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  NORMAL: { label: 'Normal', variant: 'success' },
  CRITICAL: { label: 'Crítico', variant: 'destructive' },
  OBSOLETE: { label: 'Obsoleto', variant: 'warning' },
}

function rotationColor(days: number) {
  if (days >= 120) return 'text-destructive'
  if (days >= 60) return 'text-warning'
  return 'text-success'
}

function rotationLabel(days: number) {
  if (days >= 120) return 'Lenta'
  if (days >= 60) return 'Media'
  return 'Alta'
}

export default function InventarioPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'totalValue' | 'rotationDays' | 'stock'>('totalValue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    api.inventory.list()
      .then(setData)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  async function refresh() {
    try {
      const result = await api.inventory.list()
      setData(result)
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
  }

  if (loading) return <SkeletonKPIsAndTable cols={7} rows={6} />
  if (!data) return <div className="text-center text-muted-foreground py-20">Error cargando inventario</div>

  const items = (data.items || [])
    .filter((i: any) => filter === 'ALL' || i.status === filter)
    .sort((a: any, b: any) => {
      const va = sortBy === 'totalValue' ? Number(a.totalValue) : sortBy === 'rotationDays' ? a.rotationDays : Number(a.stock)
      const vb = sortBy === 'totalValue' ? Number(b.totalValue) : sortBy === 'rotationDays' ? b.rotationDays : Number(b.stock)
      return sortDir === 'desc' ? vb - va : va - vb
    })

  const totalItems = data.items?.length || 0
  const totalStock = data.items?.reduce((s: number, i: any) => s + Number(i.stock), 0) || 0
  const avgRotation = totalItems > 0 ? Math.round(data.items.reduce((s: number, i: any) => s + i.rotationDays, 0) / totalItems) : 0

  function handleSort(col: 'totalValue' | 'rotationDays' | 'stock') {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Gestión de Inventario"
        subtitle={`Grupo Ibérico SA · Marzo 2026 · ${totalItems} referencias`}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCSV('inventario', ['SKU', 'Descripción', 'Stock', 'Coste Unit.', 'Valor Total', 'Rotación (días)', 'Estado'], (data.items || []).map((i: any) => [i.sku, i.description, Number(i.stock), Number(i.unitCost), Number(i.totalValue), i.rotationDays, i.status]))}><Download size={14} className="mr-1" />Exportar</Button>
        }
      />

      {/* Alertas */}
      {data.obsoleteCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{data.obsoleteCount} referencia{data.obsoleteCount > 1 ? 's' : ''} obsoleta{data.obsoleteCount > 1 ? 's' : ''} detectada{data.obsoleteCount > 1 ? 's' : ''}</div>
            <div className="text-xs opacity-80 mt-0.5">Rotación superior a 120 días — considerar liquidación o provisión contable</div>
          </div>
        </div>
      )}
      {data.criticalCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{data.criticalCount} referencia{data.criticalCount > 1 ? 's' : ''} en nivel crítico</div>
            <div className="text-xs opacity-80 mt-0.5">Stock bajo mínimo de seguridad — riesgo de rotura de suministro</div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Valor Total Stock', value: fmtEur(data.totalValue), color: 'text-foreground' },
          { label: 'Unidades Totales', value: fmt(totalStock), color: 'text-foreground' },
          { label: 'Rotación Media', value: `${avgRotation} días`, color: rotationColor(avgRotation) },
          { label: 'Cobertura', value: `${Math.round(avgRotation / 7)} sem`, color: 'text-foreground' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Distribución por estado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Valor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data.items || [])
                .sort((a: any, b: any) => Number(b.totalValue) - Number(a.totalValue))
                .map((item: any) => {
                  const pct = data.totalValue > 0 ? (Number(item.totalValue) / data.totalValue) * 100 : 0
                  const cfg = statusConfig[item.status] || statusConfig.NORMAL
                  return (
                    <div key={item.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground font-medium">{item.description}</span>
                        <span className="text-muted-foreground">{fmtEur(Number(item.totalValue))} ({fmt(pct, 1)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: cfg.variant === 'destructive' ? 'hsl(var(--destructive))' : cfg.variant === 'warning' ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Resumen por Estado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { status: 'NORMAL', count: (data.items || []).filter((i: any) => i.status === 'NORMAL').length, value: (data.items || []).filter((i: any) => i.status === 'NORMAL').reduce((s: number, i: any) => s + Number(i.totalValue), 0) },
              { status: 'CRITICAL', count: data.criticalCount, value: (data.items || []).filter((i: any) => i.status === 'CRITICAL').reduce((s: number, i: any) => s + Number(i.totalValue), 0) },
              { status: 'OBSOLETE', count: data.obsoleteCount, value: (data.items || []).filter((i: any) => i.status === 'OBSOLETE').reduce((s: number, i: any) => s + Number(i.totalValue), 0) },
            ].map(g => {
              const cfg = statusConfig[g.status]
              return (
                <div key={g.status} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2.5">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground">{g.count} ref.</span>
                  </div>
                  <span className="font-mono text-xs font-semibold">{fmtEur(g.value)}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de detalle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Detalle de Inventario</CardTitle>
            <div className="flex gap-1.5">
              {[
                { key: 'ALL', label: 'Todos' },
                { key: 'NORMAL', label: 'Normal' },
                { key: 'CRITICAL', label: 'Crítico' },
                { key: 'OBSOLETE', label: 'Obsoleto' },
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
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">SKU</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Descripción</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => handleSort('stock')}>
                  Stock{sortIcon('stock')}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Coste Unit.</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => handleSort('totalValue')}>
                  Valor Total{sortIcon('totalValue')}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => handleSort('rotationDays')}>
                  Rotación{sortIcon('rotationDays')}
                </th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Estado</th>
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">% del Total</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(page * 10, (page + 1) * 10).map((item: any) => {
                const cfg = statusConfig[item.status] || statusConfig.NORMAL
                const pct = data.totalValue > 0 ? (Number(item.totalValue) / data.totalValue) * 100 : 0
                return (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                    <td className="p-3">
                      <div className="font-medium">{item.description}</div>
                      {item.warehouse && <div className="text-xs text-muted-foreground">{item.warehouse}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs">{fmt(Number(item.stock))}</td>
                    <td className="p-3 font-mono text-xs">{fmtEur(Number(item.unitCost), 2)}</td>
                    <td className="p-3 font-mono text-xs font-semibold">{fmtEur(Number(item.totalValue))}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-bold ${rotationColor(item.rotationDays)}`}>{item.rotationDays}d</span>
                        <span className={`text-[10px] ${rotationColor(item.rotationDays)}`}>{rotationLabel(item.rotationDays)}</span>
                      </div>
                    </td>
                    <td className="p-3"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{fmt(pct, 1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
</ScrollableTable>
        {items.length > 10 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</Button>
            {Array.from({ length: Math.ceil(items.length / 10) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= Math.ceil(items.length / 10) - 1} onClick={() => setPage(p => p + 1)}>→</Button>
            <span className="text-xs text-muted-foreground ml-2">{page * 10 + 1}–{Math.min((page + 1) * 10, items.length)} de {items.length}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
