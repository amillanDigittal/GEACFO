'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { exportCSV } from '@/lib/utils'
import { useHydrated } from '@/hooks/use-hydrated'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { VirtualTableBody } from '@/components/ui/virtual-table'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { PageHeader } from '@/components/page-header'
import { KpiBox } from '@/components/kpi-box'
import { Select } from '@/components/ui/select'
import { Download, ClipboardList, X } from 'lucide-react'

function extractDetail(log: any): string {
  if (log.oldValue?.email) return log.oldValue.email
  if (log.newValue?.name) return log.newValue.name
  if (log.newValue?.email) return log.newValue.email
  if (log.oldValue?.ids) return `${log.oldValue.ids.length} items`
  if (log.oldValue?.accountAlias) return log.oldValue.accountAlias
  if (log.newValue?.count !== undefined) return `${log.newValue.count} registros`
  return ''
}

// ── Filter select ───────────────────────────────────────────────────
function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  )
}

/* ── Activity Heatmap (GitHub-style) ─────────────────────────────── */
function ActivityHeatmap({ logs, heatmapFilter, onCellClick }: {
  logs: any[]
  heatmapFilter: { day: string; hour: number } | null
  onCellClick: (day: string, hour: number) => void
}) {
  const heatmap = useMemo(() => {
    // Build 30 days × 24 hours grid
    const now = new Date()
    const days: { date: Date; label: string; short: string }[] = []
    for (let d = 29; d >= 0; d--) {
      const date = new Date(now)
      date.setDate(date.getDate() - d)
      date.setHours(0, 0, 0, 0)
      days.push({
        date,
        label: date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        short: date.toLocaleDateString('es-ES', { weekday: 'narrow' }),
      })
    }

    // Count per day×hour
    const grid: number[][] = Array.from({ length: 24 }, () => Array(30).fill(0))
    let max = 0
    logs.forEach(l => {
      const d = new Date(l.createdAt)
      const dayIdx = days.findIndex(day =>
        d.getFullYear() === day.date.getFullYear() &&
        d.getMonth() === day.date.getMonth() &&
        d.getDate() === day.date.getDate()
      )
      if (dayIdx >= 0) {
        const h = d.getHours()
        grid[h][dayIdx]++
        if (grid[h][dayIdx] > max) max = grid[h][dayIdx]
      }
    })

    // Collapse to business hours (6-22) for display
    const hours = Array.from({ length: 17 }, (_, i) => i + 6)

    return { days, grid, hours, max }
  }, [logs])

  const { days, grid, hours, max } = heatmap
  const CELL = 14
  const GAP = 2

  function intensity(count: number): string {
    if (count === 0) return 'hsl(var(--muted))'
    const ratio = max > 0 ? count / max : 0
    if (ratio > 0.75) return 'hsl(var(--success))'
    if (ratio > 0.5) return 'hsl(var(--success) / 0.7)'
    if (ratio > 0.25) return 'hsl(var(--success) / 0.4)'
    return 'hsl(var(--success) / 0.2)'
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {/* Hour labels */}
        <div className="flex flex-col gap-[2px] mr-1 pt-[18px]">
          {hours.map(h => (
            <div key={h} className="text-[9px] text-muted-foreground font-mono leading-none" style={{ height: CELL }}>
              {h % 3 === 0 ? `${String(h).padStart(2, '0')}h` : ''}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, di) => (
          <div key={di} className="flex flex-col items-center gap-[2px]">
            {/* Day label */}
            <div className="text-[8px] text-muted-foreground font-mono leading-none h-[14px] flex items-end">
              {di % 3 === 0 ? day.label : ''}
            </div>
            {/* Hour cells */}
            {hours.map(h => {
              const count = grid[h][di]
              const dayISO = day.date.toISOString().slice(0, 10)
              const isSelected = heatmapFilter?.day === dayISO && heatmapFilter?.hour === h
              return (
                <div
                  key={h}
                  className={`rounded-[3px] transition-colors heatmap-cell cursor-pointer ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    backgroundColor: intensity(count),
                  }}
                  title={`${day.label} ${String(h).padStart(2, '0')}:00 — ${count} evento${count !== 1 ? 's' : ''}`}
                  onClick={() => onCellClick(dayISO, h)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[9px] text-muted-foreground">Menos</span>
        {[0, 0.2, 0.4, 0.7, 1].map((r, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-[2px]"
            style={{
              backgroundColor: r === 0
                ? 'hsl(var(--muted))'
                : `hsl(var(--success) / ${r === 1 ? '1' : r})`
            }}
          />
        ))}
        <span className="text-[9px] text-muted-foreground">Más</span>
      </div>
    </div>
  )
}

export default function AuditoriaPage() {
  const t = useTranslations('auditoria')
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [heatmapFilter, setHeatmapFilter] = useState<{ day: string; hour: number } | null>(null)

  const hydrated = useHydrated()

  // ── Label maps ──────────────────────────────────────────────────────
  const ACTION_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
    CREATE: { label: t('actionCreate'), variant: 'success' },
    UPDATE: { label: t('actionUpdate'), variant: 'warning' },
    DELETE: { label: t('actionDelete'), variant: 'destructive' },
    APPROVE: { label: t('actionApprove'), variant: 'success' },
    APPROVE_BATCH: { label: t('actionApproveBatch'), variant: 'success' },
    REJECT: { label: t('actionReject'), variant: 'destructive' },
    RECONCILE: { label: t('actionReconcile'), variant: 'success' },
    RECONCILE_BATCH: { label: t('actionReconcileBatch'), variant: 'success' },
    RECATEGORIZE: { label: t('actionRecategorize'), variant: 'warning' },
    LOGIN: { label: t('actionLogin'), variant: 'secondary' },
    RECALCULATE_SCORE: { label: t('actionRecalculate'), variant: 'warning' },
    RECALCULATE_ALL: { label: t('actionRecalculateAll'), variant: 'warning' },
    INIT: { label: t('actionInit'), variant: 'success' },
    CREATE_SNAPSHOT: { label: t('actionSnapshot'), variant: 'success' },
    SEND: { label: t('actionSend'), variant: 'success' },
    RESOLVE: { label: t('actionResolve'), variant: 'success' },
    IMPORT: { label: t('actionImport'), variant: 'success' },
  }

  const ENTITY_LABELS: Record<string, string> = {
    User: t('entityUser'),
    Tenant: t('entityTenant'),
    TenantConfig: t('entityConfig'),
    InvoiceAP: t('entityInvoiceAP'),
    InvoiceAR: t('entityInvoiceAR'),
    BankMovement: t('entityMovement'),
    Supplier: t('entitySupplier'),
    Customer: t('entityCustomer'),
    BudgetLine: t('entityBudget'),
    ProvisionSnapshot: t('entityProvision'),
    ReportSchedule: t('entityReport'),
    AlertResolution: t('entityAlert'),
    Session: t('entitySession'),
    InventoryItem: t('entityInventory'),
  }

  function fetchData() {
    setLoading(true)
    api.governance.audit()
      .then(setLogs)
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }

  useEffect(() => { fetchData() }, [])

  // Derive unique filter options from data
  const filterOptions = useMemo(() => {
    const actions = [...new Set(logs.map((l: any) => l.action))].sort()
    const entities = [...new Set(logs.map((l: any) => l.entity))].sort()
    const users = [...new Map(logs.filter((l: any) => l.user).map((l: any) => [l.userId, l.user.name])).entries()]
    return {
      actions: actions.map(a => ({ value: a, label: ACTION_LABELS[a]?.label || a })),
      entities: entities.map(e => ({ value: e, label: ENTITY_LABELS[e] || e })),
      users: users.map(([id, name]) => ({ value: id, label: name })),
    }
  }, [logs])

  // Apply filters
  const filtered = useMemo(() => {
    let result = logs
    if (actionFilter) result = result.filter((l: any) => l.action === actionFilter)
    if (entityFilter) result = result.filter((l: any) => l.entity === entityFilter)
    if (userFilter) result = result.filter((l: any) => l.userId === userFilter)
    if (dateFrom) {
      const from = new Date(dateFrom)
      result = result.filter((l: any) => new Date(l.createdAt) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59')
      result = result.filter((l: any) => new Date(l.createdAt) <= to)
    }
    if (heatmapFilter) {
      result = result.filter((l: any) => {
        const d = new Date(l.createdAt)
        const logDay = d.toISOString().slice(0, 10)
        return logDay === heatmapFilter.day && d.getHours() === heatmapFilter.hour
      })
    }
    return result
  }, [logs, actionFilter, entityFilter, userFilter, dateFrom, dateTo, heatmapFilter])

  const hasFilters = !!(actionFilter || entityFilter || userFilter || dateFrom || dateTo || heatmapFilter)

  // Summary stats
  const todayCount = useMemo(() => {
    const today = new Date().toDateString()
    return filtered.filter((l: any) => new Date(l.createdAt).toDateString() === today).length
  }, [filtered])

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach((l: any) => { counts[l.action] = (counts[l.action] || 0) + 1 })
    return counts
  }, [filtered])

  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]
  const activeUsers = new Set(filtered.map((l: any) => l.userId).filter(Boolean)).size

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={7} rows={8} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(
              'auditoria',
              [t('colDate'), t('colUser'), t('colRole'), t('colAction'), t('colEntity'), t('colEntityId'), t('colDetail'), t('colIp')],
              filtered.map((l: any) => [
                new Date(l.createdAt).toLocaleString('es-ES'),
                l.user?.name || '',
                l.user?.role || '',
                l.action,
                l.entity,
                l.entityId || '',
                extractDetail(l),
                l.ipAddress || '',
              ])
            )}
          >
            <Download size={14} className="mr-1" />{t('exportCsv')}
          </Button>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpiTotalRecords'), value: String(filtered.length), color: '' },
          { label: t('kpiToday'), value: String(todayCount), color: todayCount > 0 ? 'text-primary' : '' },
          { label: t('kpiFrequentAction'), value: topAction ? (ACTION_LABELS[topAction[0]]?.label || topAction[0]) : '—', color: '' },
          { label: t('kpiActiveUsers'), value: String(activeUsers), color: '' },
        ].map((m, i) => (
          <KpiBox key={m.label} index={i} label={m.label} value={m.value} color={m.color || 'text-foreground'} />
        ))}
      </div>

      {/* Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>{t('heatmapTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap
            logs={logs}
            heatmapFilter={heatmapFilter}
            onCellClick={(day, hour) =>
              setHeatmapFilter(prev =>
                prev?.day === day && prev?.hour === hour ? null : { day, hour }
              )
            }
          />
          {heatmapFilter && (
            <div className="flex items-center gap-2 text-xs text-primary mt-3">
              <span>Filtro: {heatmapFilter.day} a las {String(heatmapFilter.hour).padStart(2, '0')}:00</span>
              <button onClick={() => setHeatmapFilter(null)} className="underline hover:text-primary/80 transition-colors">Limpiar</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect label={t('filterAction')} value={actionFilter} onChange={setActionFilter} options={filterOptions.actions} />
            <FilterSelect label={t('filterEntity')} value={entityFilter} onChange={setEntityFilter} options={filterOptions.entities} />
            <FilterSelect label={t('filterUser')} value={userFilter} onChange={setUserFilter} options={filterOptions.users} />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('filterFrom')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-muted/50 backdrop-blur-sm text-xs text-foreground hover:border-primary/40 transition-all duration-200"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('filterTo')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-muted/50 backdrop-blur-sm text-xs text-foreground hover:border-primary/40 transition-all duration-200"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => { setActionFilter(''); setEntityFilter(''); setUserFilter(''); setDateFrom(''); setDateTo(''); setHeatmapFilter(null) }}
              >
                <X size={12} className="mr-1" />{t('clearFilters')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>{t('auditLogTitle')}</CardTitle>
            {hasFilters && <Badge variant="secondary">{t('resultsCount', { count: filtered.length })}</Badge>}
          </div>
        </CardHeader>
        {filtered.length === 0 ? (
          <CardContent>
            <div className="text-center py-12">
              <div className="mb-3 opacity-30"><ClipboardList size={28} className="mx-auto text-muted-foreground" /></div>
              <div className="text-sm text-muted-foreground">
                {hasFilters ? t('noResultsFiltered') : t('noRecords')}
              </div>
            </div>
          </CardContent>
        ) : (
          <>
            <ScrollableTable label={t('auditLogTitle')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('colDate'), t('colUser'), t('colRole'), t('colAction'), t('colEntity'), t('colId'), t('colDetail'), t('colIp')].map(h => (
                      <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
              </table>
            </ScrollableTable>
            <VirtualTableBody
              data={filtered}
              getKey={(log: any) => log.id}
              renderRow={(log: any) => {
                const actionCfg = ACTION_LABELS[log.action]
                  || (log.action?.includes('FAILED')
                    ? { label: log.action, variant: 'destructive' as const }
                    : { label: log.action, variant: 'secondary' as const })
                const entityLabel = ENTITY_LABELS[log.entity] || log.entity
                const detail = extractDetail(log)
                return (
                  <>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-3 text-xs font-medium">{log.user?.name || '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{log.user?.role || '—'}</td>
                    <td className="p-3"><Badge variant={actionCfg.variant}>{actionCfg.label}</Badge></td>
                    <td className="p-3 text-xs">{entityLabel}</td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.entityId ? log.entityId.slice(0, 12) + '…' : '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]">{detail || '—'}</td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.ipAddress || '—'}</td>
                  </>
                )
              }}
            />
          </>
        )}
      </Card>
    </div>
  )
}
