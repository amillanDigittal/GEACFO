'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useNotifications, useResolutions, usePredictive } from '@/hooks/use-api'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useHydrated } from '@/hooks/use-hydrated'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { exportCSV } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { KpiBox } from '@/components/kpi-box'
import {
  Bell, BellOff, Search, Download, Filter, CheckCircle2, Clock, Eye,
  AlertTriangle, XCircle, ExternalLink, MessageSquare, ChevronDown, Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

const PAGE_SIZE = 10

interface Notification {
  id: string
  type: string
  severity: string
  icon: string
  title: string
  description: string
  link: string
  timestamp: string
}

interface Resolution {
  alertId: string
  status: string
  notes: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  updatedAt: string
}

export default function NotificacionesPage() {
  const t = useTranslations('notificaciones')

  const SEVERITY_CONFIG: Record<string, { label: string; variant: 'destructive' | 'warning' | 'secondary'; color: string }> = {
    critical: { label: t('severityCritical'), variant: 'destructive', color: 'text-destructive' },
    warning: { label: t('severityWarning'), variant: 'warning', color: 'text-warning' },
    info: { label: t('severityInfo'), variant: 'secondary', color: 'text-muted-foreground' },
  }

  const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'destructive' | 'warning' | 'success' | 'secondary' | 'default' }> = {
    OPEN: { label: t('statusOpen'), icon: <Bell size={12} />, variant: 'destructive' },
    INVESTIGATING: { label: t('statusInvestigating'), icon: <Eye size={12} />, variant: 'warning' },
    RESOLVED: { label: t('statusResolved'), icon: <CheckCircle2 size={12} />, variant: 'success' },
    FALSE_POSITIVE: { label: t('statusFalsePositive'), icon: <XCircle size={12} />, variant: 'secondary' },
  }

  const TYPE_LABELS: Record<string, string> = {
    forecast: 'Forecast',
    cobros: t('typeCobros'),
    pagos: t('typePagos'),
    deuda: t('typeDeuda'),
    scoring: 'Scoring',
    inventario: t('typeInventario'),
    gobierno: t('typeGobierno'),
  }

  const { data: rawNotifications, error: nError, isLoading: nLoading, mutate: mutateNotifications } = useNotifications()
  const { data: rawResolutions, error: rError, isLoading: rLoading, mutate: mutateResolutions } = useResolutions()
  const { data: rawPredictive, error: pError, isLoading: pLoading, mutate: mutatePredictive } = usePredictive()

  const notifications: Notification[] = rawNotifications ?? []
  const resolutions: Resolution[] = rawResolutions ?? []
  const predictive: any[] = rawPredictive?.alerts ?? []

  const loading = nLoading || rLoading || pLoading
  const lastUpdated = (!loading && (rawNotifications || rawResolutions || rawPredictive)) ? new Date() : null

  const { filters, setFilters, clearFilters } = useUrlFilters({
    search: '',
    severity: 'ALL',
    type: 'ALL',
    status: 'ALL',
  })
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const loadData = () => {
    mutateNotifications()
    mutateResolutions()
    mutatePredictive()
  }

  useKeyboardShortcuts([
    { key: 'r', label: 'Actualizar datos', action: loadData },
  ])

  const hydrated = useHydrated()

  const [showRuleEditor, setShowRuleEditor] = useState(false)
  const [customRules, setCustomRules] = useState<Array<{ id: string; metric: string; operator: string; value: number; enabled: boolean }>>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('geacfo-alert-rules') || '[]')
    } catch { return [] }
  })
  const [ruleMetric, setRuleMetric] = useState('dso')
  const [ruleOperator, setRuleOperator] = useState('>')
  const [ruleValue, setRuleValue] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('geacfo-alert-rules', JSON.stringify(customRules))
    }
  }, [customRules])

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={5} rows={8} />

  // Build resolution map
  const resMap = new Map<string, Resolution>()
  resolutions.forEach(r => resMap.set(r.alertId, r))

  function getStatus(alertId: string): string {
    return resMap.get(alertId)?.status || 'OPEN'
  }

  // Filtered + searched notifications
  const filtered = notifications.filter(n => {
    if (filters.severity !== 'ALL' && n.severity !== filters.severity) return false
    if (filters.type !== 'ALL' && n.type !== filters.type) return false
    const status = getStatus(n.id)
    if (filters.status !== 'ALL' && status !== filters.status) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!n.title.toLowerCase().includes(q) && !n.description.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Counts
  const totalOpen = notifications.filter(n => getStatus(n.id) === 'OPEN').length
  const totalInvestigating = notifications.filter(n => getStatus(n.id) === 'INVESTIGATING').length
  const totalResolved = notifications.filter(n => getStatus(n.id) === 'RESOLVED' || getStatus(n.id) === 'FALSE_POSITIVE').length
  const criticalCount = notifications.filter(n => n.severity === 'critical' && getStatus(n.id) === 'OPEN').length

  // Unique types present
  const types = [...new Set(notifications.map(n => n.type))]

  async function handleStatusChange(alertId: string, newStatus: string) {
    setUpdating(alertId)
    try {
      await api.alerts.updateResolution(alertId, newStatus, noteInput || undefined)
      toast({ title: t('statusUpdated'), description: t('alertMarkedAs', { status: STATUS_CONFIG[newStatus]?.label || newStatus }) })
      setNoteInput('')
      setExpandedId(null)
      mutateResolutions()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setUpdating(null)
    }
  }

  function fmtDate(d: string) {
    const date = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 0) return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    if (diffMin < 1) return t('timeNow')
    if (diffMin < 60) return t('timeMinutesAgo', { minutes: diffMin })
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return t('timeHoursAgo', { hours: diffH })
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return t('timeDaysAgo', { days: diffD })
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  function addRule() {
    const val = parseFloat(ruleValue)
    if (isNaN(val)) return
    setCustomRules(prev => [...prev, { id: `rule-${Date.now()}`, metric: ruleMetric, operator: ruleOperator, value: val, enabled: true }])
    setRuleValue('')
  }

  function removeRule(id: string) {
    setCustomRules(prev => prev.filter(r => r.id !== id))
  }

  function toggleRule(id: string) {
    setCustomRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const ALERT_METRICS = [
    { key: 'dso', label: t('ruleMetricDso'), unit: t('ruleUnitDays') },
    { key: 'dpo', label: t('ruleMetricDpo'), unit: t('ruleUnitDays') },
    { key: 'liquidity', label: t('ruleMetricLiquidity'), unit: 'x' },
    { key: 'cash', label: t('ruleMetricCash'), unit: '€' },
    { key: 'supplier_risk', label: t('ruleMetricSupplierRisk'), unit: '' },
    { key: 'forecast_gaps', label: t('ruleMetricForecastGaps'), unit: '' },
    { key: 'covenant_margin', label: t('ruleMetricCovenantMargin'), unit: '%' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: notifications.length })}
        lastUpdated={lastUpdated}
        onRefresh={loadData}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCSV('alertas',
            [t('csvTitle'), t('csvType'), t('csvSeverity'), t('csvStatus'), t('csvDescription'), t('csvDate')],
            notifications.map(n => [n.title, TYPE_LABELS[n.type] || n.type, n.severity, getStatus(n.id), n.description, new Date(n.timestamp).toLocaleDateString('es-ES')])
          )}><Download size={14} className="mr-1" />{t('export')}</Button>
        }
      />

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpiPending'), value: totalOpen, icon: <Bell size={16} />, color: totalOpen > 0 ? 'text-destructive' : 'text-success' },
          { label: t('kpiInvestigating'), value: totalInvestigating, icon: <Eye size={16} />, color: totalInvestigating > 0 ? 'text-warning' : 'text-foreground' },
          { label: t('kpiResolved'), value: totalResolved, icon: <CheckCircle2 size={16} />, color: 'text-success' },
          { label: t('kpiCriticalOpen'), value: criticalCount, icon: <AlertTriangle size={16} />, color: criticalCount > 0 ? 'text-destructive' : 'text-success' },
        ].map((m, i) => (
          <KpiBox key={m.label} index={i} label={m.label} value={m.value} icon={m.icon} color={m.color} />
        ))}
      </div>

      {/* Custom Alert Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>{t('rulesTitle')}</CardTitle>
            <Button size="sm" variant={showRuleEditor ? 'secondary' : 'default'} onClick={() => setShowRuleEditor(!showRuleEditor)}>
              {showRuleEditor ? t('rulesHideEditor') : t('rulesAddRule')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Rule editor */}
          {showRuleEditor && (
            <div className="flex gap-2 items-end flex-wrap p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest">{t('rulesMetric')}</label>
                <select value={ruleMetric} onChange={e => setRuleMetric(e.target.value)} className="block mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm">
                  {ALERT_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest">{t('rulesCondition')}</label>
                <select value={ruleOperator} onChange={e => setRuleOperator(e.target.value)} className="block mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm w-20">
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value=">=">&ge;</option>
                  <option value="<=">&le;</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest">{t('rulesValue')}</label>
                <input type="number" value={ruleValue} onChange={e => setRuleValue(e.target.value)} placeholder="45" className="block mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm w-28" onKeyDown={e => e.key === 'Enter' && addRule()} />
              </div>
              <Button size="sm" onClick={addRule} disabled={!ruleValue}>{t('rulesCreate')}</Button>
            </div>
          )}

          {/* Active rules */}
          {customRules.length > 0 ? (
            <div className="space-y-2">
              {customRules.map(rule => {
                const metric = ALERT_METRICS.find(m => m.key === rule.metric)
                return (
                  <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-lg border ${rule.enabled ? 'border-border bg-background' : 'border-border/50 bg-muted/20 opacity-60'}`}>
                    <button onClick={() => toggleRule(rule.id)} className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${rule.enabled ? 'bg-success' : 'bg-muted'}`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{metric?.label || rule.metric}</span>
                      <span className="text-muted-foreground mx-1">{rule.operator}</span>
                      <span className="font-mono font-bold">{rule.value}</span>
                      {metric?.unit && <span className="text-muted-foreground ml-1">{metric.unit}</span>}
                    </div>
                    <button onClick={() => removeRule(rule.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">{t('rulesEmpty')}</div>
          )}
        </CardContent>
      </Card>

      {/* Predictive Alerts */}
      {predictive.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔮</span>
              <CardTitle>{t('predictiveAlerts')}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{t('predictionsCount', { count: predictive.length })}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {predictive.map((p: any) => {
              const svCfg = SEVERITY_CONFIG[p.severity] || SEVERITY_CONFIG.info
              const pctBar = p.threshold > 0 ? Math.min((p.currentValue / p.threshold) * 100, 150) : 0
              const projBar = p.threshold > 0 ? Math.min((p.projectedValue / p.threshold) * 100, 150) : 0
              return (
                <div key={p.id} className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold">{p.title}</span>
                        <Badge variant={svCfg.variant}>{svCfg.label}</Badge>
                        {p.weeksAhead && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Clock size={10} />
                            {t('weeksAhead', { weeks: p.weeksAhead })}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] font-mono">{t('confidence', { percent: p.confidence })}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                      <p className="text-xs text-primary mt-1 font-medium">📊 {p.prediction}</p>
                      {/* Mini metric bar */}
                      {p.threshold > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-muted-foreground w-14">{t('metricCurrent')}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pctBar, 100)}%` }} />
                            </div>
                            <span className="font-mono w-16 text-right">{typeof p.currentValue === 'number' && p.currentValue > 1000 ? `${(p.currentValue / 1000).toFixed(0)}k` : p.currentValue}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-muted-foreground w-14">{t('metricProjected')}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${projBar > 100 ? 'bg-destructive' : 'bg-warning'}`} style={{ width: `${Math.min(projBar, 100)}%` }} />
                            </div>
                            <span className="font-mono w-16 text-right">{typeof p.projectedValue === 'number' && Math.abs(p.projectedValue) > 1000 ? `${(p.projectedValue / 1000).toFixed(0)}k` : p.projectedValue}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-muted-foreground w-14">{t('metricThreshold')}</span>
                            <div className="flex-1 h-px bg-destructive/50 relative">
                              <div className="absolute -top-1 right-0 w-1.5 h-1.5 rounded-full bg-destructive" />
                            </div>
                            <span className="font-mono w-16 text-right text-destructive">{typeof p.threshold === 'number' && p.threshold > 1000 ? `${(p.threshold / 1000).toFixed(0)}k` : p.threshold}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="flex-shrink-0 h-7 px-2" onClick={() => router.push(p.link)}>
                      <ExternalLink size={12} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={e => { setFilters({ search: e.target.value }); setPage(0) }}
                placeholder={t('searchPlaceholder')}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Severity filter */}
            <div className="flex items-center gap-1">
              <Filter size={12} className="text-muted-foreground" />
              {['ALL', 'critical', 'warning', 'info'].map(s => (
                <button
                  key={s}
                  onClick={() => { setFilters({ severity: s }); setPage(0) }}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${filters.severity === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {s === 'ALL' ? t('filterAll') : SEVERITY_CONFIG[s]?.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <Select
              value={filters.type}
              onChange={e => { setFilters({ type: e.target.value }); setPage(0) }}
              className="h-8 text-xs"
            >
              <option value="ALL">{t('filterAllTypes')}</option>
              {types.map(tp => <option key={tp} value={tp}>{TYPE_LABELS[tp] || tp}</option>)}
            </Select>

            {/* Status filter */}
            <Select
              value={filters.status}
              onChange={e => { setFilters({ status: e.target.value }); setPage(0) }}
              className="h-8 text-xs"
            >
              <option value="ALL">{t('filterAllStatuses')}</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>

            <span className="text-xs text-muted-foreground ml-auto">{t('resultsCount', { count: filtered.length })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Notification list */}
      <div className="space-y-2">
        {paged.length === 0 && (
          <Card>
            <CardContent>
              <EmptyState
                variant="alerts"
                title={t('noAlertsFound')}
                description="No se encontraron alertas con los filtros seleccionados"
              />
            </CardContent>
          </Card>
        )}

        {paged.map(n => {
          const status = getStatus(n.id)
          const stCfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN
          const svCfg = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info
          const resolution = resMap.get(n.id)
          const isExpanded = expandedId === n.id
          const isResolved = status === 'RESOLVED' || status === 'FALSE_POSITIVE'

          return (
            <Card key={n.id} className={`transition-colors ${isResolved ? 'opacity-60' : ''}`}>
              <div className="p-4">
                {/* Main row */}
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`text-xl flex-shrink-0 mt-0.5 ${isResolved ? 'grayscale' : ''}`}>{n.icon}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-sm font-semibold ${isResolved ? 'line-through text-muted-foreground' : ''}`}>{n.title}</span>
                      <Badge variant={svCfg.variant}>{svCfg.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[n.type] || n.type}</Badge>
                      <Badge variant={stCfg.variant} className="gap-1">{stCfg.icon}{stCfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                    {resolution?.notes && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare size={10} className="mt-0.5 flex-shrink-0" />
                        <span>{resolution.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDate(n.timestamp)}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => router.push(n.link)}>
                      <ExternalLink size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => { setExpandedId(isExpanded ? null : n.id); setNoteInput(resolution?.notes || '') }}
                    >
                      <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </div>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{t('changeStatus')}:</span>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <Button
                          key={key}
                          variant={status === key ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={updating === n.id}
                          onClick={() => handleStatusChange(n.id, key)}
                        >
                          {cfg.icon}{cfg.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        placeholder={t('addNotePlaceholder')}
                        className="h-8 text-xs flex-1"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && noteInput.trim()) {
                            handleStatusChange(n.id, status)
                          }
                        }}
                      />
                      {noteInput.trim() && (
                        <Button size="sm" className="h-8 text-xs" onClick={() => handleStatusChange(n.id, status)} disabled={updating === n.id}>
                          {t('saveNote')}
                        </Button>
                      )}
                    </div>
                    {resolution && (
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        {resolution.resolvedBy && <div>{t('resolvedBy')}: {resolution.resolvedBy}</div>}
                        {resolution.resolvedAt && <div>{t('resolutionDate')}: {new Date(resolution.resolvedAt).toLocaleString('es-ES')}</div>}
                        <div>{t('lastUpdate')}: {new Date(resolution.updatedAt).toLocaleString('es-ES')}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</Button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>→</Button>
          <span className="text-xs text-muted-foreground ml-2">{t('paginationInfo', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, filtered.length), total: filtered.length })}</span>
        </div>
      )}
    </div>
  )
}
