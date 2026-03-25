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
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { PageHeader } from '@/components/page-header'
import { Download, ClipboardList, ChevronLeft, ChevronRight, X } from 'lucide-react'

const PAGE_SIZE = 25

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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function AuditoriaPage() {
  const t = useTranslations('auditoria')
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [page, setPage] = useState(0)

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
    return result
  }, [logs, actionFilter, entityFilter, userFilter, dateFrom, dateTo])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [actionFilter, entityFilter, userFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const hasFilters = !!(actionFilter || entityFilter || userFilter || dateFrom || dateTo)

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
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color || 'text-foreground'}`}>{m.value}</div>
          </div>
        ))}
      </div>

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
                className="h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('filterTo')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => { setActionFilter(''); setEntityFilter(''); setUserFilter(''); setDateFrom(''); setDateTo('') }}
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
                <tbody>
                  {pageData.map((log: any) => {
                    const actionCfg = ACTION_LABELS[log.action]
                      || (log.action?.includes('FAILED')
                        ? { label: log.action, variant: 'destructive' as const }
                        : { label: log.action, variant: 'secondary' as const })
                    const entityLabel = ENTITY_LABELS[log.entity] || log.entity
                    const detail = extractDetail(log)
                    return (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollableTable>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {t('paginationRange', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, filtered.length), total: filtered.length })}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  // Show pages around current page
                  let p: number
                  if (totalPages <= 5) {
                    p = i
                  } else if (page < 3) {
                    p = i
                  } else if (page > totalPages - 4) {
                    p = totalPages - 5 + i
                  } else {
                    p = page - 2 + i
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        p === page ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p + 1}
                    </button>
                  )
                })}
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
