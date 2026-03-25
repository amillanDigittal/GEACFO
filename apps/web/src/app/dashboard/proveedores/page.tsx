'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useSuppliers, useSupplier } from '@/hooks/use-api'
import { useHydrated } from '@/hooks/use-hydrated'
import { fmtEur, riskLabel, riskVariant } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Plus, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { PageHeader } from '@/components/page-header'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { useTranslations } from 'next-intl'

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Activo', ON_WATCH: 'En Observación', SUSPENDED: 'Suspendido', INACTIVE: 'Inactivo' }
const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { ACTIVE: 'success', ON_WATCH: 'warning', SUSPENDED: 'destructive', INACTIVE: 'secondary' }

function ScoreBar({ value, label }: { value: number | null; label: string }) {
  const v = value ?? 0
  const color = v >= 75 ? 'hsl(var(--success))' : v >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="font-mono text-[10px] font-bold w-6 text-right" style={{ color }}>{v}</span>
    </div>
  )
}

export default function ProveedoresPage() {
  const t = useTranslations('proveedores')
  const { data: suppliers = [], isLoading, mutate } = useSuppliers()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', nif: '', email: '', phone: '', category: '', paymentTerms: 30, notes: '' })
  const [creating, setCreating] = useState(false)
  const [recalculating, setRecalculating] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const { data: detail } = useSupplier(expandedId)

  async function refresh() {
    await mutate()
    setLastUpdated(new Date())
  }

  async function handleCreate() {
    if (!form.code || !form.name) return
    setCreating(true)
    try {
      await api.suppliers.create({ ...form, paymentTerms: Number(form.paymentTerms) || 30 })
      setShowForm(false)
      setForm({ code: '', name: '', nif: '', email: '', phone: '', category: '', paymentTerms: 30, notes: '' })
      await mutate()
    } catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    try {
      await api.suppliers.remove(id)
      await mutate()
      if (expandedId === id) setExpandedId(null)
    } catch (e) { console.error(e) }
  }

  async function recalculate(id: string) {
    setRecalculating(prev => new Set(prev).add(id))
    try {
      await api.suppliers.recalculate(id)
      await mutate()
    } catch (e) { console.error(e) }
    finally { setRecalculating(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  async function recalculateAll() {
    setRecalculating(new Set(['__all__']))
    try {
      await api.suppliers.recalculateAll()
      await mutate()
    } catch (e) { console.error(e) }
    finally { setRecalculating(new Set()) }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
  }

  const hydrated = useHydrated()

  if (!hydrated || isLoading) return <SkeletonKPIsAndTable cols={9} rows={6} />

  const totalVolume = suppliers.reduce((s, sup) => s + (sup.totalVolume || 0), 0)
  const avgScore = suppliers.filter(s => s.overallScore).length > 0
    ? Math.round(suppliers.filter(s => s.overallScore).reduce((s, sup) => s + sup.overallScore, 0) / suppliers.filter(s => s.overallScore).length)
    : 0
  const atRisk = suppliers.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length
  const pageSize = 10
  const totalPages = Math.ceil(suppliers.length / pageSize)

  // Chart: top 10 by volume
  const top10 = [...suppliers].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 10)
  const chartData = top10.map(s => ({ name: s.name.length > 18 ? s.name.slice(0, 18) + '…' : s.name, volumen: s.totalVolume }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: suppliers.length })}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={recalculateAll} disabled={recalculating.has('__all__')}>
              <RefreshCw size={14} className={`mr-1 ${recalculating.has('__all__') ? 'animate-spin' : ''}`} />
              {t('recalculateAll')}
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? <X size={14} className="mr-1" /> : <Plus size={14} className="mr-1" />}
              {showForm ? t('cancel') : t('newSupplier')}
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('activeSuppliers'), value: String(suppliers.filter(s => s.status === 'ACTIVE').length) },
          { label: t('totalVolume'), value: fmtEur(totalVolume) },
          { label: t('averageScore'), value: avgScore > 0 ? String(avgScore) : '—', color: avgScore >= 75 ? 'text-success' : avgScore >= 50 ? 'text-warning' : 'text-destructive' },
          { label: t('atRisk'), value: String(atRisk), color: atRisk > 0 ? 'text-destructive' : 'text-success' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color || 'text-foreground'}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* New supplier form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>{t('newSupplierTitle')}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { key: 'code', label: t('fieldCode'), placeholder: 'PROV-001' },
                { key: 'name', label: t('fieldName'), placeholder: t('fieldNamePlaceholder') },
                { key: 'nif', label: t('fieldNif'), placeholder: 'B12345678' },
                { key: 'email', label: t('fieldEmail'), placeholder: 'contacto@proveedor.es' },
                { key: 'phone', label: t('fieldPhone'), placeholder: '+34 600 000 000' },
                { key: 'category', label: t('fieldCategory'), placeholder: t('fieldCategoryPlaceholder') },
                { key: 'paymentTerms', label: t('fieldPaymentTerms'), placeholder: '30' },
                { key: 'notes', label: t('fieldNotes'), placeholder: t('fieldNotesPlaceholder') },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">{f.label}</label>
                  <input
                    type={f.key === 'paymentTerms' ? 'number' : 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleCreate} disabled={creating || !form.code || !form.name}>
                {creating ? t('creating') : t('createSupplier')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {top10.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('top10ByVolume')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={115} />
                <Tooltip formatter={(v: any) => [fmtEur(v), t('volumeLabel')]} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--card-foreground))' }} itemStyle={{ color: 'hsl(var(--card-foreground))' }} labelStyle={{ color: 'hsl(var(--card-foreground))' }} />
                <Bar dataKey="volumen" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Suppliers Table */}
      <Card>
        <CardHeader><CardTitle>{t('supplierDirectory')}</CardTitle></CardHeader>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[t('colSupplier'), t('colCategory'), t('colScore'), t('colRisk'), t('colVolume'), t('colPending'), t('colTerm'), t('colStatus'), t('colAction')].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.slice(page * pageSize, (page + 1) * pageSize).map(s => {
                const isExpanded = expandedId === s.id
                const scoreColor = s.overallScore == null ? undefined : s.overallScore >= 75 ? 'hsl(var(--success))' : s.overallScore >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'
                return (
                  <tr key={s.id} className={`border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/50' : ''}`} onClick={() => toggleExpand(s.id)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.code}{s.nif ? ` · ${s.nif}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{s.category || '—'}</td>
                    <td className="p-3">
                      {s.overallScore != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-12">
                            <div className="h-full rounded-full" style={{ width: `${s.overallScore}%`, background: scoreColor }} />
                          </div>
                          <span className="font-mono text-xs font-bold" style={{ color: scoreColor }}>{s.overallScore}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3"><Badge variant={riskVariant(s.riskLevel)}>{riskLabel(s.riskLevel)}</Badge></td>
                    <td className="p-3 font-mono text-xs">{fmtEur(s.totalVolume || 0)}</td>
                    <td className="p-3 font-mono text-xs" style={{ color: s.pendingAmount > 0 ? 'hsl(var(--warning))' : undefined }}>{fmtEur(s.pendingAmount || 0)}</td>
                    <td className="p-3 font-mono text-xs">{s.paymentTerms}d</td>
                    <td className="p-3"><Badge variant={STATUS_VARIANTS[s.status] || 'secondary'}>{STATUS_LABELS[s.status] || s.status}</Badge></td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => recalculate(s.id)} disabled={recalculating.has(s.id) || recalculating.has('__all__')}>
                          <RefreshCw size={13} className={recalculating.has(s.id) ? 'animate-spin' : ''} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {suppliers.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">{t('noSuppliers')}</td></tr>
              )}
            </tbody>
          </table>
        </ScrollableTable>

        {/* Expanded detail */}
        {expandedId && detail && (
          <div className="border-t border-border bg-muted/30 p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Scoring radar */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t('scoring')} — {detail.name}</div>
                {detail.overallScore != null ? (
                  <div className="space-y-2">
                    <ScoreBar value={detail.reliabilityScore} label={t('reliability')} />
                    <ScoreBar value={detail.deliveryScore} label={t('deliveries')} />
                    <ScoreBar value={detail.qualityScore} label={t('quality')} />
                    <div className="pt-2 mt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('globalScore')}</span>
                        <span className="font-mono text-lg font-bold" style={{ color: detail.overallScore >= 75 ? 'hsl(var(--success))' : detail.overallScore >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>{detail.overallScore}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('noScoring')}</div>
                )}
              </div>

              {/* Info */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t('information')}</div>
                <div className="space-y-2 text-sm">
                  {detail.email && <div><span className="text-muted-foreground">{t('infoEmail')}:</span> {detail.email}</div>}
                  {detail.phone && <div><span className="text-muted-foreground">{t('infoPhone')}:</span> {detail.phone}</div>}
                  {detail.nif && <div><span className="text-muted-foreground">{t('infoNif')}:</span> {detail.nif}</div>}
                  <div><span className="text-muted-foreground">{t('infoPaymentTerm')}:</span> {t('infoDays', { days: detail.paymentTerms })}</div>
                  {detail.category && <div><span className="text-muted-foreground">{t('infoCategory')}:</span> {detail.category}</div>}
                  {detail.notes && <div><span className="text-muted-foreground">{t('infoNotes')}:</span> {detail.notes}</div>}
                </div>
              </div>

              {/* Recent invoices */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t('recentInvoices')}</div>
                {detail.invoices?.length > 0 ? (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {detail.invoices.slice(0, 8).map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                        <div>
                          <span className="font-medium">{inv.number}</span>
                          <span className="text-muted-foreground ml-2">{new Date(inv.dueDate).toLocaleDateString('es-ES')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{fmtEur(Number(inv.totalAmount))}</span>
                          <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'REJECTED' ? 'destructive' : 'warning'} className="text-[9px] px-1 py-0">
                            {inv.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('noInvoices')}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>&#8592;</Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>&#8594;</Button>
            <span className="text-xs text-muted-foreground ml-2">{t('pagination', { from: page * pageSize + 1, to: Math.min((page + 1) * pageSize, suppliers.length), total: suppliers.length })}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
