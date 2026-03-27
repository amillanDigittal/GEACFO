'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmt, exportCSV } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, RefreshCw, AlertTriangle, XCircle, Ban, Building2, Landmark, Users, Package, Link2, Download, ClipboardList } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { PageHeader } from '@/components/page-header'
import { useTranslations } from 'next-intl'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

export default function GobiernoPage() {
  const t = useTranslations('gobierno')
  const [sources, setSources] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'fuentes' | 'auditoria'>('fuentes')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary'; icon: React.ReactNode }> = {
    SYNCED: { label: t('statusSynced'), variant: 'success', icon: <CheckCircle2 size={14} /> },
    SYNCING: { label: t('statusSyncing'), variant: 'default' as any, icon: <RefreshCw size={14} /> },
    WARNING: { label: t('statusWarning'), variant: 'warning', icon: <AlertTriangle size={14} /> },
    ERROR: { label: t('statusError'), variant: 'destructive', icon: <XCircle size={14} /> },
    DISCONNECTED: { label: t('statusDisconnected'), variant: 'secondary', icon: <Ban size={14} /> },
  }

  const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    ERP: { label: 'ERP', icon: <Building2 size={18} />, color: 'hsl(var(--primary))' },
    BANKING: { label: t('typeBanking'), icon: <Landmark size={18} />, color: 'hsl(var(--success))' },
    CRM: { label: 'CRM', icon: <Users size={18} />, color: 'hsl(var(--warning))' },
    WMS: { label: t('typeWarehouse'), icon: <Package size={18} />, color: 'hsl(var(--chart-blue))' },
    OTHER: { label: t('typeOther'), icon: <Link2 size={18} />, color: 'hsl(var(--muted-foreground))' },
  }

  function fetchData() {
    setLoading(true)
    return Promise.all([
      api.governance.sources(),
      api.governance.audit(),
    ])
      .then(([s, a]) => { setSources(s); setAuditLog(a) })
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }

  useEffect(() => { fetchData() }, [])

  async function refresh() {
    await fetchData()
  }

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={6} rows={5} />

  const totalRecords = sources.reduce((s, src) => s + src.recordCount, 0)
  const syncedCount = sources.filter(s => s.status === 'SYNCED').length
  const warningCount = sources.filter(s => s.status === 'WARNING' || s.status === 'ERROR').length
  const typeGroups = sources.reduce((acc: Record<string, number>, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc }, {})

  const ACTION_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
    CREATE: { label: t('actionCreate'), variant: 'success' },
    UPDATE: { label: t('actionUpdate'), variant: 'warning' },
    DELETE: { label: t('actionDelete'), variant: 'destructive' },
    APPROVE: { label: t('actionApprove'), variant: 'success' },
    APPROVE_BATCH: { label: t('actionApproveBatch'), variant: 'success' },
    RECONCILE: { label: t('actionReconcile'), variant: 'success' },
    RECONCILE_BATCH: { label: t('actionReconcileBatch'), variant: 'success' },
    LOGIN: { label: 'Login', variant: 'secondary' },
    RECALCULATE_SCORE: { label: t('actionRecalculate'), variant: 'warning' },
    RECALCULATE_ALL: { label: t('actionRecalculateAll'), variant: 'warning' },
    INIT: { label: t('actionInit'), variant: 'success' },
    CREATE_SNAPSHOT: { label: 'Snapshot', variant: 'success' },
    SEND: { label: t('actionSend'), variant: 'success' },
    RESOLVE: { label: t('actionResolve'), variant: 'success' },
  }

  const ENTITY_LABELS: Record<string, string> = {
    User: t('entityUser'), Tenant: t('entityTenant'), TenantConfig: t('entityConfig'), InvoiceAP: t('entityInvoiceAP'),
    BankMovement: t('entityMovement'), Supplier: t('entitySupplier'), Customer: t('entityCustomer'), BudgetLine: t('entityBudget'),
    ProvisionSnapshot: t('entityProvision'), ReportSchedule: t('entityReport'), AlertResolution: t('entityAlert'), Session: t('entitySession'),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <>
            <div className="pill-tabs">
              {(['fuentes', 'auditoria'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`${activeTab === tab ? 'pill-tab-active' : 'pill-tab'} pill-tab-xs`}
                >
                  {tab === 'fuentes' ? t('tabSources') : t('tabAudit')}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => { if (activeTab === 'fuentes') { exportCSV('gobierno_fuentes', [t('colSource'), t('colType'), t('colStatus'), t('colRecords'), t('colLastSync')], sources.map(s => [s.name, s.type, s.status, s.recordCount, s.lastSync || ''])) } else { exportCSV('gobierno_auditoria', [t('colDate'), t('colUser'), t('colAction'), t('colEntity'), t('colEntityId'), 'IP'], auditLog.map((l: any) => [l.createdAt, l.user?.name || l.userId || '', l.action, l.entity, l.entityId || '', l.ipAddress || ''])) } }}><Download size={14} className="mr-1" />{t('export')}</Button>
          </>
        }
      />

      {/* Alertas */}
      {warningCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{t('sourcesWithIssues', { count: warningCount })}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {sources.filter(s => s.status === 'WARNING' || s.status === 'ERROR').map(s => s.name).join(', ')} — {t('reviewConnectivity')}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpiConnectedSources'), value: `${sources.length}`, color: 'text-foreground' },
          { label: t('kpiGlobalStatus'), value: warningCount === 0 ? 'OK' : t('kpiAlertCount', { count: warningCount }), color: warningCount === 0 ? 'text-success' : 'text-warning' },
          { label: t('kpiTotalRecords'), value: fmt(totalRecords), color: 'text-foreground' },
          { label: t('kpiSynced'), value: `${syncedCount}/${sources.length}`, color: syncedCount === sources.length ? 'text-success' : 'text-warning' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {activeTab === 'fuentes' && (
        <>
          {/* Mapa de fuentes por tipo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader><CardTitle>{t('tabSources')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {sources.map(src => {
                    const status = statusConfig[src.status] || statusConfig.SYNCED
                    const type = typeConfig[src.type] || typeConfig.OTHER
                    const pct = totalRecords > 0 ? (src.recordCount / totalRecords) * 100 : 0
                    return (
                      <div key={src.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${type.color}15` }}>
                          {type.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{src.name}</span>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{type.label}</span>
                            <span>·</span>
                            <span>{fmt(src.recordCount)} {t('records')}</span>
                            <span>·</span>
                            <span>{src.lastSync ? timeAgo(src.lastSync) : t('noSync')}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: type.color }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono text-xs font-semibold">{pct.toFixed(1)}%</div>
                          <div className="text-[10px] text-muted-foreground">{t('ofTotal')}</div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {/* Por tipo */}
              <Card>
                <CardHeader><CardTitle>{t('byType')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(typeGroups).map(([type, count]) => {
                    const cfg = typeConfig[type] || typeConfig.OTHER
                    const typeRecords = sources.filter(s => s.type === type).reduce((sum, s) => sum + s.recordCount, 0)
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{cfg.icon}</span>
                          <span className="text-sm">{cfg.label}</span>
                          <span className="text-xs text-muted-foreground">({count})</span>
                        </div>
                        <span className="font-mono text-xs">{fmt(typeRecords)}</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Estado de sincronización */}
              <Card>
                <CardHeader><CardTitle>{t('syncStatus')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {['SYNCED', 'WARNING', 'ERROR', 'DISCONNECTED'].map(status => {
                    const count = sources.filter(s => s.status === status).length
                    if (count === 0) return null
                    const cfg = statusConfig[status]
                    return (
                      <div key={status} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span>{cfg.icon}</span>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                        <span className="font-mono text-sm font-bold">{count}</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Calidad de datos */}
              <Card>
                <CardHeader><CardTitle>{t('dataQuality')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: t('qualityCompleteness'), value: 94.2, good: true },
                    { label: t('qualityConsistency'), value: 98.5, good: true },
                    { label: t('qualityTimeliness'), value: warningCount > 0 ? 83.1 : 97.0, good: warningCount === 0 },
                    { label: t('qualityUniqueness'), value: 99.8, good: true },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{m.label}</span>
                        <span className={`font-mono font-semibold ${m.good ? 'text-success' : 'text-warning'}`}>{m.value}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.good ? 'hsl(var(--success))' : 'hsl(var(--warning))' }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tabla detallada */}
          <Card>
            <CardHeader><CardTitle>{t('sourceDetail')}</CardTitle></CardHeader>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('colSource'), t('colType'), t('colStatus'), t('colRecords'), t('colPercentTotal'), t('colLastSync'), t('colLatency')].map(h => (
                      <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.map(src => {
                    const status = statusConfig[src.status] || statusConfig.SYNCED
                    const type = typeConfig[src.type] || typeConfig.OTHER
                    const pct = totalRecords > 0 ? (src.recordCount / totalRecords) * 100 : 0
                    const syncDate = src.lastSync ? new Date(src.lastSync) : null
                    const latencyMins = syncDate ? Math.floor((Date.now() - syncDate.getTime()) / 60000) : null
                    return (
                      <tr key={src.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span>{type.icon}</span>
                            <span className="font-medium">{src.name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{type.label}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={status.variant}>{status.icon} {status.label}</Badge>
                        </td>
                        <td className="p-3 font-mono text-xs">{fmt(src.recordCount)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-12">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: type.color }} />
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {syncDate ? syncDate.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="p-3">
                          {latencyMins !== null && (
                            <span className={`font-mono text-xs font-semibold ${latencyMins > 60 ? 'text-warning' : 'text-success'}`}>
                              {latencyMins < 60 ? `${latencyMins}m` : latencyMins < 1440 ? `${Math.floor(latencyMins / 60)}h ${latencyMins % 60}m` : `${Math.floor(latencyMins / 1440)}d`}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
</ScrollableTable>
          </Card>
        </>
      )}

      {activeTab === 'auditoria' && (() => {
        const pageSize = 20
        const actionFilter = '' // could be state-driven in future
        const filtered = auditLog
        const totalPages = Math.ceil(filtered.length / pageSize)
        // Count by action for summary
        const actionCounts: Record<string, number> = {}
        filtered.forEach((l: any) => { actionCounts[l.action] = (actionCounts[l.action] || 0) + 1 })
        const todayCount = filtered.filter((l: any) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length
        return (
          <>
            {/* Activity summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: t('auditTotalRecords'), value: String(filtered.length) },
                { label: t('auditToday'), value: String(todayCount), color: todayCount > 0 ? 'text-primary' : '' },
                { label: t('auditMostFrequentAction'), value: Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—' },
                { label: t('auditActiveUsers'), value: String(new Set(filtered.map((l: any) => l.userId).filter(Boolean)).size) },
              ].map(m => (
                <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
                  <div className={`font-mono text-xl font-bold ${m.color || 'text-foreground'}`}>{m.value}</div>
                </div>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>{t('auditLog')}</CardTitle></CardHeader>
              {filtered.length === 0 ? (
                <CardContent>
                  <div className="text-center py-12">
                    <div className="mb-3 opacity-30"><ClipboardList size={28} className="mx-auto text-muted-foreground" /></div>
                    <div className="text-sm text-muted-foreground">{t('noAuditRecords')}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('auditAutoRecord')}</div>
                  </div>
                </CardContent>
              ) : (
                <>
                  <ScrollableTable>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {[t('colDate'), t('colUser'), t('colAction'), t('colEntity'), 'ID', t('colDetail'), 'IP'].map(h => (
                            <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, pageSize).map((log: any) => {
                          const actionCfg = ACTION_LABELS[log.action] || (log.action?.includes('FAILED') ? { label: log.action, variant: 'destructive' as const } : { label: log.action, variant: 'secondary' as const })
                          const entityLabel = ENTITY_LABELS[log.entity] || log.entity
                          // Extract meaningful detail from oldValue/newValue
                          let detail = ''
                          if (log.oldValue?.email) detail = log.oldValue.email
                          else if (log.newValue?.name) detail = log.newValue.name
                          else if (log.newValue?.email) detail = log.newValue.email
                          else if (log.oldValue?.ids) detail = `${log.oldValue.ids.length} items`
                          return (
                            <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="p-3 text-xs font-medium">{log.user?.name || '—'}</td>
                              <td className="p-3"><Badge variant={actionCfg.variant}>{actionCfg.label}</Badge></td>
                              <td className="p-3 text-xs">{entityLabel}</td>
                              <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.entityId ? log.entityId.slice(0, 10) + '…' : '—'}</td>
                              <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]">{detail || '—'}</td>
                              <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.ipAddress || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollableTable>
                  {filtered.length > pageSize && (
                    <div className="p-3 border-t border-border text-center text-xs text-muted-foreground">
                      {t('showingOfTotal', { showing: Math.min(pageSize, filtered.length), total: filtered.length })}
                    </div>
                  )}
                </>
              )}
            </Card>
          </>
        )
      })()}
    </div>
  )
}
