'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, fmtPct, riskLabel, riskVariant } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { SkeletonProvisiones } from '@/components/ui/skeleton-page'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'
import { useTranslations } from 'next-intl'
import { LazyChart } from '@/components/ui/lazy-chart'

const RISK_ORDER = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function cellBg(rate: number): string {
  if (rate >= 0.25) return 'bg-destructive/20'
  if (rate >= 0.10) return 'bg-destructive/10'
  if (rate >= 0.05) return 'bg-warning/15'
  if (rate >= 0.02) return 'bg-warning/10'
  return ''
}

export default function ProvisionesPage() {
  const t = useTranslations('provisiones')
  const [data, setData] = useState<any>(null)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [page, setPage] = useState(0)

  async function loadData() {
    try {
      const [matrix, snaps] = await Promise.all([api.provisions.matrix(), api.provisions.snapshots()])
      setData(matrix)
      setSnapshots(snaps)
    } catch (err) { console.error(err) }
    finally { setLoading(false); setLastUpdated(new Date()) }
  }

  useEffect(() => { loadData() }, [])

  async function refresh() {
    try {
      const [matrix, snaps] = await Promise.all([api.provisions.matrix(), api.provisions.snapshots()])
      setData(matrix)
      setSnapshots(snaps)
    } catch (err) { console.error(err) }
    finally { setLastUpdated(new Date()) }
  }

  async function saveSnapshot() {
    setSaving(true)
    try {
      await api.provisions.saveSnapshot()
      const snaps = await api.provisions.snapshots()
      setSnapshots(snaps)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonProvisiones />

  if (!data || data.customerCount === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} lastUpdated={lastUpdated} onRefresh={refresh} />
        <Card><CardContent className="py-16 text-center text-muted-foreground">{t('noInvoices')}</CardContent></Card>
      </div>
    )
  }

  const bucketOrder = ['CURRENT', 'DAYS_1_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90P']
  const matrix = data.matrix

  // Matrix totals by row
  const rowTotals = bucketOrder.map(b => {
    let exp = 0, prov = 0
    RISK_ORDER.forEach(r => { exp += matrix[b]?.[r]?.exposure || 0; prov += matrix[b]?.[r]?.provision || 0 })
    return { exposure: exp, provision: prov }
  })
  // Matrix totals by column
  const colTotals = RISK_ORDER.map(r => {
    let exp = 0, prov = 0
    bucketOrder.forEach(b => { exp += matrix[b]?.[r]?.exposure || 0; prov += matrix[b]?.[r]?.provision || 0 })
    return { exposure: exp, provision: prov }
  })

  const chartData = data.bucketSummary.map((b: any) => ({
    name: b.label,
    exposicion: b.exposure,
    provision: b.provision,
  }))

  const snapshotChart = snapshots.slice().reverse().map((s: any) => ({
    date: new Date(s.snapshotDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    provision: Number(s.totalProvision),
    exposicion: Number(s.totalExposure),
  }))

  const details: any[] = data.details
  const pageSize = 10
  const totalPages = Math.ceil(details.length / pageSize)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <Button variant="outline" size="sm" onClick={saveSnapshot} disabled={saving}>
            <Save size={14} className="mr-1" />
            {saving ? t('saving') : t('saveSnapshot')}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('totalExposure'), value: fmtEur(data.totalExposure), color: '' },
          { label: t('provisionNiif9'), value: fmtEur(data.totalProvision), color: 'text-warning' },
          { label: t('eclCoverage'), value: fmtPct(data.coverageRate), color: 'text-primary' },
          { label: t('customersAtRisk'), value: String(data.customersAtRisk), color: data.customersAtRisk > 0 ? 'text-destructive' : 'text-success' },
        ].map((m, i) => (
          <KpiBox key={m.label} index={i} label={m.label} value={m.value} color={m.color || 'text-foreground'} />
        ))}
      </div>

      {/* Provision Matrix */}
      <Card>
        <CardHeader><CardTitle>{t('provisionMatrix')}</CardTitle></CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{t('aging')}</th>
                {RISK_ORDER.map(r => (
                  <th key={r} className="text-center p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{riskLabel(r)}</th>
                ))}
                <th className="text-center p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider bg-muted/50">{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {bucketOrder.map((b, bi) => (
                <tr key={b} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium text-xs whitespace-nowrap">{data.bucketLabels[b]}</td>
                  {RISK_ORDER.map(r => {
                    const cell = matrix[b]?.[r] || { exposure: 0, provision: 0, lossRate: 0 }
                    return (
                      <td key={r} className={`p-3 text-center ${cellBg(cell.lossRate)}`}>
                        {cell.exposure > 0 ? (
                          <div>
                            <div className="font-mono text-xs">{fmtEur(cell.exposure)}</div>
                            <div className="font-mono text-[10px] text-destructive font-semibold">−{fmtEur(cell.provision)}</div>
                            <div className="text-[9px] text-muted-foreground">{fmtPct(cell.lossRate * 100)}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="p-3 text-center bg-muted/50">
                    <div className="font-mono text-xs font-semibold">{fmtEur(rowTotals[bi].exposure)}</div>
                    <div className="font-mono text-[10px] text-destructive font-semibold">−{fmtEur(rowTotals[bi].provision)}</div>
                  </td>
                </tr>
              ))}
              {/* Column totals */}
              <tr className="border-t-2 border-border bg-muted/50 font-semibold">
                <td className="p-3 text-xs">{t('total')}</td>
                {colTotals.map((ct, i) => (
                  <td key={i} className="p-3 text-center">
                    <div className="font-mono text-xs">{fmtEur(ct.exposure)}</div>
                    <div className="font-mono text-[10px] text-destructive">−{fmtEur(ct.provision)}</div>
                  </td>
                ))}
                <td className="p-3 text-center">
                  <div className="font-mono text-xs">{fmtEur(data.totalExposure)}</div>
                  <div className="font-mono text-[10px] text-destructive font-bold">−{fmtEur(data.totalProvision)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t('distributionByAging')}</CardTitle></CardHeader>
          <CardContent>
            <LazyChart height={280}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    formatter={(v: any, name: string) => [fmtEur(v), name === 'exposicion' ? t('exposureLabel') : t('provisionLabel')]}

                  />
                  <Legend formatter={(value: string) => value === 'exposicion' ? t('exposureLabel') : t('provisionEclLabel')} />
                  <Bar dataKey="exposicion" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="provision" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </LazyChart>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('provisionEvolution')}</CardTitle></CardHeader>
          <CardContent>
            {snapshotChart.length > 1 ? (
              <LazyChart height={280}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={snapshotChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      formatter={(v: any, name: string) => [fmtEur(v), name === 'provision' ? t('provisionLabel') : t('exposureLabel')]}

                    />
                    <Legend formatter={(value: string) => value === 'provision' ? t('provisionEclLabel') : t('exposureLabel')} />
                    <Line type="monotone" dataKey="provision" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="exposicion" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </LazyChart>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                {t('snapshotHint')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card>
        <CardHeader><CardTitle>{t('provisionByClient')}</CardTitle></CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[t('colClient'), t('colScore'), t('colRisk'), t('colExposure'), t('colProvision'), t('colCoverage'), t('colCurrent'), t('colOverdue')].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {details.slice(page * pageSize, (page + 1) * pageSize).map((c: any) => {
                const coverage = c.totalExposure > 0 ? (c.totalProvision / c.totalExposure) * 100 : 0
                const overdue = c.totalExposure - (c.buckets?.CURRENT?.exposure || 0)
                const scoreColor = c.creditScore == null ? 'text-muted-foreground' : c.creditScore >= 80 ? 'hsl(var(--success))' : c.creditScore >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'
                return (
                  <tr key={c.customerId} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.code}</div>
                    </td>
                    <td className="p-3">
                      {c.creditScore != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-12">
                            <div className="h-full rounded-full" style={{ width: `${c.creditScore}%`, background: scoreColor }} />
                          </div>
                          <span className="font-mono text-xs font-bold" style={{ color: scoreColor }}>{c.creditScore}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3"><Badge variant={riskVariant(c.riskLevel)}>{riskLabel(c.riskLevel)}</Badge></td>
                    <td className="p-3 font-mono text-xs">{fmtEur(c.totalExposure)}</td>
                    <td className="p-3 font-mono text-xs text-destructive font-semibold">{fmtEur(c.totalProvision)}</td>
                    <td className="p-3 font-mono text-xs" style={{ color: coverage > 10 ? 'hsl(var(--destructive))' : coverage > 5 ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>{fmtPct(coverage)}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{fmtEur(c.buckets?.CURRENT?.exposure || 0)}</td>
                    <td className="p-3 font-mono text-xs" style={{ color: overdue > 0 ? 'hsl(var(--destructive))' : undefined }}>{fmtEur(overdue)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>&#8592;</Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>&#8594;</Button>
            <span className="text-xs text-muted-foreground ml-2">{t('pagination', { from: page * pageSize + 1, to: Math.min((page + 1) * pageSize, details.length), total: details.length })}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
