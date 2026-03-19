'use client'
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

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary'; icon: React.ReactNode }> = {
  SYNCED: { label: 'Sincronizado', variant: 'success', icon: <CheckCircle2 size={14} /> },
  SYNCING: { label: 'Sincronizando', variant: 'default' as any, icon: <RefreshCw size={14} /> },
  WARNING: { label: 'Advertencia', variant: 'warning', icon: <AlertTriangle size={14} /> },
  ERROR: { label: 'Error', variant: 'destructive', icon: <XCircle size={14} /> },
  DISCONNECTED: { label: 'Desconectado', variant: 'secondary', icon: <Ban size={14} /> },
}

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ERP: { label: 'ERP', icon: <Building2 size={18} />, color: 'hsl(var(--primary))' },
  BANKING: { label: 'Banca', icon: <Landmark size={18} />, color: 'hsl(var(--success))' },
  CRM: { label: 'CRM', icon: <Users size={18} />, color: 'hsl(var(--warning))' },
  WMS: { label: 'Almacén', icon: <Package size={18} />, color: 'hsl(210 60% 55%)' },
  OTHER: { label: 'Otro', icon: <Link2 size={18} />, color: 'hsl(var(--muted-foreground))' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

export default function GobiernoPage() {
  const [sources, setSources] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'fuentes' | 'auditoria'>('fuentes')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  if (loading) return <SkeletonKPIsAndTable cols={6} rows={5} />

  const totalRecords = sources.reduce((s, src) => s + src.recordCount, 0)
  const syncedCount = sources.filter(s => s.status === 'SYNCED').length
  const warningCount = sources.filter(s => s.status === 'WARNING' || s.status === 'ERROR').length
  const typeGroups = sources.reduce((acc: Record<string, number>, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Gobierno del Dato"
        subtitle="Trazabilidad y calidad de datos · Grupo Ibérico SA"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <>
            <div className="flex bg-muted rounded-lg p-0.5">
              {(['fuentes', 'auditoria'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab === 'fuentes' ? 'Fuentes de Datos' : 'Auditoría'}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => { if (activeTab === 'fuentes') { exportCSV('gobierno_fuentes', ['Fuente', 'Tipo', 'Estado', 'Registros', 'Última Sync'], sources.map(s => [s.name, s.type, s.status, s.recordCount, s.lastSync || ''])) } else { exportCSV('gobierno_auditoria', ['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID Entidad', 'IP'], auditLog.map((l: any) => [l.createdAt, l.user?.name || l.userId || '', l.action, l.entity, l.entityId || '', l.ipAddress || ''])) } }}><Download size={14} className="mr-1" />Exportar</Button>
          </>
        }
      />

      {/* Alertas */}
      {warningCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{warningCount} fuente{warningCount > 1 ? 's' : ''} con incidencias</div>
            <div className="text-xs opacity-80 mt-0.5">
              {sources.filter(s => s.status === 'WARNING' || s.status === 'ERROR').map(s => s.name).join(', ')} — revisar conectividad y permisos
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Fuentes Conectadas', value: `${sources.length}`, color: 'text-foreground' },
          { label: 'Estado Global', value: warningCount === 0 ? 'OK' : `${warningCount} alerta${warningCount > 1 ? 's' : ''}`, color: warningCount === 0 ? 'text-success' : 'text-warning' },
          { label: 'Registros Totales', value: fmt(totalRecords), color: 'text-foreground' },
          { label: 'Sincronizadas', value: `${syncedCount}/${sources.length}`, color: syncedCount === sources.length ? 'text-success' : 'text-warning' },
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
                <CardHeader><CardTitle>Fuentes de Datos</CardTitle></CardHeader>
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
                            <span>{fmt(src.recordCount)} registros</span>
                            <span>·</span>
                            <span>{src.lastSync ? timeAgo(src.lastSync) : 'Sin sync'}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: type.color }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono text-xs font-semibold">{pct.toFixed(1)}%</div>
                          <div className="text-[10px] text-muted-foreground">del total</div>
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
                <CardHeader><CardTitle>Por Tipo</CardTitle></CardHeader>
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
                <CardHeader><CardTitle>Estado Sync</CardTitle></CardHeader>
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
                <CardHeader><CardTitle>Calidad de Datos</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Completitud', value: 94.2, good: true },
                    { label: 'Consistencia', value: 98.5, good: true },
                    { label: 'Puntualidad', value: warningCount > 0 ? 83.1 : 97.0, good: warningCount === 0 },
                    { label: 'Unicidad', value: 99.8, good: true },
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
            <CardHeader><CardTitle>Detalle de Fuentes</CardTitle></CardHeader>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Fuente', 'Tipo', 'Estado', 'Registros', '% Total', 'Última Sync', 'Latencia'].map(h => (
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

      {activeTab === 'auditoria' && (
        <Card>
          <CardHeader><CardTitle>Registro de Auditoría</CardTitle></CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-3 opacity-30"><ClipboardList size={28} className="mx-auto text-muted-foreground" /></div>
                <div className="text-sm text-muted-foreground">No hay registros de auditoría</div>
                <div className="text-xs text-muted-foreground mt-1">Las acciones del sistema se registrarán aquí automáticamente</div>
              </div>
            ) : (
              <ScrollableTable>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID', 'IP'].map(h => (
                        <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((log: any) => (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 text-xs">{log.user?.name || log.userId || '—'}</td>
                        <td className="p-3"><Badge variant="secondary">{log.action}</Badge></td>
                        <td className="p-3 text-xs">{log.entity}</td>
                        <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.entityId ? log.entityId.slice(0, 8) + '…' : '—'}</td>
                        <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.ipAddress || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</ScrollableTable>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
