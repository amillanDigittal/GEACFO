'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtEur, riskLabel, riskVariant, exportCSV } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Siren, CheckCircle2, Search, ClipboardList, ShieldCheck, ShieldX, Eye } from 'lucide-react'
import { ScrollableTable } from '@/components/ui/scrollable-table'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonFraude } from '@/components/ui/skeleton-page'

type TabKey = 'alertas' | 'anomalias' | 'audit'

const severityConfig: Record<string, { label: string; variant: 'destructive' | 'warning' | 'secondary' }> = {
  CRITICAL: { label: 'Crítica', variant: 'destructive' },
  HIGH: { label: 'Alta', variant: 'destructive' },
  MEDIUM: { label: 'Media', variant: 'warning' },
  LOW: { label: 'Baja', variant: 'secondary' },
}

function daysDiff(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

interface FraudAlert {
  id: string
  type: 'CUSTOMER_RISK' | 'OVERDUE_CONCENTRATION' | 'CREDIT_EXCEEDED' | 'PAYMENT_ANOMALY' | 'DUPLICATE_INVOICE'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
  entity: string
  entityId: string
  amount?: number
  detectedAt: string
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED'
}

interface Anomaly {
  id: string
  type: string
  description: string
  invoiceNumber: string
  entity: string
  amount: number
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detectedAt: string
}

export default function FraudePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [invoicesAR, setInvoicesAR] = useState<any[]>([])
  const [invoicesAP, setInvoicesAP] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [resolutions, setResolutions] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('alertas')
  const [actionAlert, setActionAlert] = useState<string | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [anomPage, setAnomPage] = useState(0)
  const [auditPage, setAuditPage] = useState(0)
  const [alertPage, setAlertPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  function fetchData() {
    return Promise.all([
      api.customers.list(),
      api.treasury.ar(),
      api.treasury.ap(),
      api.governance.audit(),
      api.alerts.resolutions(),
    ])
      .then(([cust, ar, ap, audit, res]) => {
        setCustomers(cust)
        setInvoicesAR(ar)
        setInvoicesAP(ap)
        setAuditLog(audit)
        const resMap: Record<string, any> = {}
        res.forEach((r: any) => { resMap[r.alertId] = r })
        setResolutions(resMap)
        setLastUpdated(new Date())
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleRefresh() {
    await fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleResolve(alertId: string, status: string) {
    setSaving(true)
    try {
      const res = await api.alerts.updateResolution(alertId, status, actionNotes || undefined)
      setResolutions(prev => ({ ...prev, [alertId]: res }))
      toast({ title: 'Alerta actualizada', description: status === 'RESOLVED' ? 'Marcada como resuelta' : status === 'FALSE_POSITIVE' ? 'Marcada como falso positivo' : status === 'INVESTIGATING' ? 'En investigación' : 'Reabierta' })
      setActionAlert(null)
      setActionNotes('')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonFraude />

  // ── Generate fraud alerts from real data ──
  const alerts: FraudAlert[] = []

  // 1. Customer risk alerts
  customers.forEach(c => {
    if (c.riskLevel === 'CRITICAL' || c.status === 'ALERT' || c.status === 'SUSPENDED') {
      alerts.push({
        id: `risk-${c.id}`,
        type: 'CUSTOMER_RISK',
        severity: c.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        title: `Cliente en riesgo ${c.riskLevel === 'CRITICAL' ? 'crítico' : 'alto'}: ${c.name}`,
        description: `Score crediticio: ${c.creditScore || 'N/A'} · Estado: ${c.status} · DSO: ${c.dso || 0}d`,
        entity: c.name,
        entityId: c.id,
        amount: c.invoices?.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0) || 0,
        detectedAt: c.updatedAt,
        status: c.status === 'SUSPENDED' ? 'INVESTIGATING' : 'OPEN',
      })
    }
  })

  // 2. Credit limit exceeded
  customers.forEach(c => {
    const exposure = c.invoices?.reduce((s: number, i: any) => i.status !== 'PAID' ? s + Number(i.totalAmount) - Number(i.paidAmount) : s, 0) || 0
    const limit = Number(c.creditLimit)
    if (limit > 0 && exposure > limit) {
      alerts.push({
        id: `credit-${c.id}`,
        type: 'CREDIT_EXCEEDED',
        severity: exposure > limit * 1.5 ? 'CRITICAL' : 'HIGH',
        title: `Límite de crédito superado: ${c.name}`,
        description: `Exposición: ${fmtEur(exposure)} vs Límite: ${fmtEur(limit)} (${((exposure / limit) * 100).toFixed(0)}%)`,
        entity: c.name,
        entityId: c.id,
        amount: exposure - limit,
        detectedAt: c.updatedAt,
        status: 'OPEN',
      })
    }
  })

  // 3. Overdue concentration
  const overdueAR = invoicesAR.filter((i: any) => i.status === 'OVERDUE')
  const totalAR = invoicesAR.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const overdueAmount = overdueAR.reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  if (totalAR > 0 && overdueAmount / totalAR > 0.3) {
    alerts.push({
      id: 'overdue-concentration',
      type: 'OVERDUE_CONCENTRATION',
      severity: overdueAmount / totalAR > 0.5 ? 'CRITICAL' : 'HIGH',
      title: `Alta concentración de impagos`,
      description: `${overdueAR.length} facturas vencidas representan el ${((overdueAmount / totalAR) * 100).toFixed(1)}% de la cartera total`,
      entity: 'Cartera AR',
      entityId: '',
      amount: overdueAmount,
      detectedAt: new Date().toISOString(),
      status: 'OPEN',
    })
  }

  // 4. AP anomalies: high-priority unapproved
  const highPriorityUnapproved = invoicesAP.filter((i: any) => i.priority === 'HIGH' && i.status === 'IN_REVIEW')
  if (highPriorityUnapproved.length > 0) {
    alerts.push({
      id: 'high-priority-ap',
      type: 'PAYMENT_ANOMALY',
      severity: 'MEDIUM',
      title: `${highPriorityUnapproved.length} pago(s) de alta prioridad sin aprobar`,
      description: highPriorityUnapproved.map((i: any) => `${i.number} (${i.supplier?.name})`).join(', '),
      entity: 'Cuentas por Pagar',
      entityId: '',
      amount: highPriorityUnapproved.reduce((s: number, i: any) => s + Number(i.totalAmount), 0),
      detectedAt: new Date().toISOString(),
      status: 'OPEN',
    })
  }

  // ── Generate anomalies ──
  const anomalies: Anomaly[] = []

  // Overdue invoices > 60 days
  overdueAR.forEach((i: any) => {
    const days = daysDiff(i.dueDate)
    if (days > 60) {
      anomalies.push({
        id: `overdue-${i.id}`,
        type: 'Impago prolongado',
        description: `${days} días vencida · Cliente: ${i.customer?.name}`,
        invoiceNumber: i.number,
        entity: i.customer?.name || '',
        amount: Number(i.totalAmount) - Number(i.paidAmount),
        severity: days > 90 ? 'HIGH' : 'MEDIUM',
        detectedAt: i.dueDate,
      })
    }
  })

  // Duplicate invoice number patterns (same supplier, similar amounts)
  const apBySupplier: Record<string, any[]> = {}
  invoicesAP.forEach((i: any) => {
    const key = i.supplier?.id || ''
    if (!apBySupplier[key]) apBySupplier[key] = []
    apBySupplier[key].push(i)
  })
  Object.values(apBySupplier).forEach(group => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const amtA = Number(group[i].totalAmount)
        const amtB = Number(group[j].totalAmount)
        if (amtA === amtB && Math.abs(daysDiff(group[i].issueDate) - daysDiff(group[j].issueDate)) < 7) {
          anomalies.push({
            id: `dup-${group[i].id}-${group[j].id}`,
            type: 'Posible duplicado',
            description: `Mismo proveedor (${group[i].supplier?.name}), mismo importe, emitidas en <7 días`,
            invoiceNumber: `${group[i].number} / ${group[j].number}`,
            entity: group[i].supplier?.name || '',
            amount: amtA,
            severity: 'MEDIUM',
            detectedAt: group[j].issueDate,
          })
        }
      }
    }
  })

  // Large AP without approval
  invoicesAP.forEach((i: any) => {
    const amt = Number(i.totalAmount)
    if (amt > 50000 && !i.approvedBy) {
      anomalies.push({
        id: `large-ap-${i.id}`,
        type: 'Pago grande sin aprobación',
        description: `Factura ${i.number} de ${i.supplier?.name} por ${fmtEur(amt)} sin aprobación`,
        invoiceNumber: i.number,
        entity: i.supplier?.name || '',
        amount: amt,
        severity: amt > 100000 ? 'HIGH' : 'MEDIUM',
        detectedAt: i.createdAt || i.issueDate,
      })
    }
  })

  // Apply persisted resolutions to alerts
  alerts.forEach(a => {
    const r = resolutions[a.id]
    if (r) a.status = r.status
  })

  // Sort alerts and anomalies by severity
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // ── KPIs ──
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length
  const openAlerts = alerts.filter(a => a.status === 'OPEN').length
  const totalExposure = alerts.reduce((s, a) => s + (a.amount || 0), 0)
  const riskCustomers = customers.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL')

  // Compliance score (derived from data quality)
  const complianceFactors = [
    customers.filter(c => c.creditScore !== null).length / Math.max(customers.length, 1),  // scoring coverage
    1 - (overdueAR.length / Math.max(invoicesAR.length, 1)),  // collection health
    invoicesAP.filter((i: any) => i.approvedBy).length / Math.max(invoicesAP.length, 1),  // approval compliance
    auditLog.length > 0 ? 1 : 0.5,  // audit trail exists
  ]
  const complianceScore = Math.round(complianceFactors.reduce((s, f) => s + f, 0) / complianceFactors.length * 100)

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtDateTime = (d: string) => new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const alertTypeLabels: Record<string, string> = {
    CUSTOMER_RISK: 'Riesgo Cliente',
    OVERDUE_CONCENTRATION: 'Concentración Impagos',
    CREDIT_EXCEEDED: 'Crédito Excedido',
    PAYMENT_ANOMALY: 'Anomalía Pagos',
    DUPLICATE_INVOICE: 'Factura Duplicada',
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'alertas', label: 'Alertas', count: alerts.length },
    { key: 'anomalias', label: 'Anomalías', count: anomalies.length },
    { key: 'audit', label: 'Auditoría', count: auditLog.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Fraude & Compliance"
        subtitle="Grupo Ibérico SA · Marzo 2026"
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCSV('fraude_alertas', ['Severidad', 'Tipo', 'Título', 'Descripción', 'Entidad', 'Importe', 'Estado', 'Fecha'], alerts.map(a => [a.severity, alertTypeLabels[a.type] || a.type, a.title, a.description, a.entity, a.amount || '', a.status, a.detectedAt?.slice(0, 10)]))}><Download size={14} className="mr-1" />Exportar</Button>
        }
      />

      {/* Critical banner */}
      {criticalAlerts > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{criticalAlerts} alerta{criticalAlerts > 1 ? 's' : ''} crítica{criticalAlerts > 1 ? 's' : ''} requiere{criticalAlerts > 1 ? 'n' : ''} atención inmediata</div>
            <div className="text-xs opacity-80 mt-0.5">
              {alerts.filter(a => a.severity === 'CRITICAL').map(a => a.title).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Alertas Abiertas', value: `${openAlerts}`, color: openAlerts > 0 ? 'text-destructive' : 'text-success' },
          { label: 'Exposición en Riesgo', value: fmtEur(totalExposure), color: totalExposure > 0 ? 'text-warning' : 'text-foreground' },
          { label: 'Clientes en Riesgo', value: `${riskCustomers.length}/${customers.length}`, color: riskCustomers.length > 0 ? 'text-destructive' : 'text-success' },
          { label: 'Score Compliance', value: `${complianceScore}%`, color: complianceScore >= 80 ? 'text-success' : complianceScore >= 60 ? 'text-warning' : 'text-destructive' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{m.label}</div>
            <div className={`font-mono text-xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Risk matrix + Compliance breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alert distribution by type */}
        <Card>
          <CardHeader><CardTitle>Distribución de Alertas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(
              alerts.reduce((acc, a) => {
                acc[a.type] = (acc[a.type] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            )
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const pct = alerts.length > 0 ? (count / alerts.length) * 100 : 0
                return (
                  <div key={type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{alertTypeLabels[type] || type}</span>
                      <span className="text-muted-foreground">{count} alerta{count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all bg-destructive" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            {alerts.length === 0 && (
              <div className="text-center py-8">
                <div className="mb-3 opacity-30"><CheckCircle2 size={28} className="mx-auto text-muted-foreground" /></div>
                <div className="text-sm text-muted-foreground">Sin alertas activas</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance factors */}
        <Card>
          <CardHeader><CardTitle>Factores de Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: 'Cobertura de Scoring',
                description: `${customers.filter(c => c.creditScore !== null).length}/${customers.length} clientes evaluados`,
                value: complianceFactors[0],
              },
              {
                label: 'Salud de Cobro',
                description: `${overdueAR.length} facturas vencidas de ${invoicesAR.length} total`,
                value: complianceFactors[1],
              },
              {
                label: 'Aprobaciones AP',
                description: `${invoicesAP.filter((i: any) => i.approvedBy).length}/${invoicesAP.length} facturas con aprobación`,
                value: complianceFactors[2],
              },
              {
                label: 'Trazabilidad',
                description: auditLog.length > 0 ? `${auditLog.length} registros de auditoría` : 'Sin registros',
                value: complianceFactors[3],
              },
            ].map(f => {
              const pct = Math.round(f.value * 100)
              const color = pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive'
              return (
                <div key={f.label} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className={`font-mono text-xs font-bold ${pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive'}`}>{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{f.description}</div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Risk customers */}
      {riskCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>Clientes en Vigilancia</CardTitle>
              <Badge variant="destructive">{riskCustomers.length} cliente{riskCustomers.length > 1 ? 's' : ''}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {riskCustomers
                .sort((a, b) => (a.creditScore || 0) - (b.creditScore || 0))
                .map((c: any) => {
                  const exposure = c.invoices?.reduce((s: number, i: any) => i.status !== 'PAID' ? s + Number(i.totalAmount) - Number(i.paidAmount) : s, 0) || 0
                  const overdueCount = c.invoices?.filter((i: any) => i.status === 'OVERDUE').length || 0
                  const limit = Number(c.creditLimit)
                  const utilization = limit > 0 ? (exposure / limit) * 100 : 0
                  return (
                    <div key={c.id} className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.code} · NIF: {c.nif || 'N/A'}</div>
                        </div>
                        <Badge variant={riskVariant(c.riskLevel)}>{riskLabel(c.riskLevel)}</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Score crediticio</span>
                          <span className={`font-mono font-bold ${(c.creditScore || 0) < 40 ? 'text-destructive' : 'text-warning'}`}>{c.creditScore || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Exposición</span>
                          <span className="font-mono font-semibold">{fmtEur(exposure)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Facturas vencidas</span>
                          <span className={`font-mono font-semibold ${overdueCount > 0 ? 'text-destructive' : 'text-success'}`}>{overdueCount}</span>
                        </div>
                        {limit > 0 && (
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Uso de crédito</span>
                              <span className={`font-mono text-[11px] ${utilization > 100 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>{utilization.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${utilization > 100 ? 'bg-destructive' : utilization > 80 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">DSO</span>
                          <span className="font-mono">{c.dso || 0}d</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Alertas / Anomalías / Auditoría */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Detalle</CardTitle>
            <div className="flex gap-1.5">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${tab === t.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Alertas tab */}
          {tab === 'alertas' && (
            alerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-3 opacity-30"><CheckCircle2 size={28} className="mx-auto text-muted-foreground" /></div>
                <div className="text-sm text-muted-foreground">No se han detectado alertas de fraude</div>
                <div className="text-xs text-muted-foreground mt-1">El sistema analiza clientes, facturas y pagos en busca de anomalías</div>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.slice(alertPage * 10, (alertPage + 1) * 10).map(a => {
                  const sev = severityConfig[a.severity] || severityConfig.LOW
                  const res = resolutions[a.id]
                  const isResolved = a.status === 'RESOLVED' || a.status === 'FALSE_POSITIVE'
                  const isShowingAction = actionAlert === a.id
                  return (
                    <div key={a.id} className={`p-4 rounded-lg border ${isResolved ? 'border-border bg-card opacity-60' : a.severity === 'CRITICAL' ? 'border-destructive/30 bg-destructive/5' : a.severity === 'HIGH' ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-card'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={sev.variant}>{sev.label}</Badge>
                          <Badge variant="secondary">{alertTypeLabels[a.type] || a.type}</Badge>
                        </div>
                        <Badge variant={a.status === 'OPEN' ? 'destructive' : a.status === 'INVESTIGATING' ? 'warning' : 'success'}>
                          {a.status === 'OPEN' ? 'Abierta' : a.status === 'INVESTIGATING' ? 'Investigando' : a.status === 'FALSE_POSITIVE' ? 'Falso positivo' : 'Resuelta'}
                        </Badge>
                      </div>
                      <div className="font-semibold text-sm mb-1">{a.title}</div>
                      <div className="text-xs text-muted-foreground mb-2">{a.description}</div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {a.amount !== undefined && a.amount > 0 && (
                            <span>Importe: <span className="font-mono font-semibold text-foreground">{fmtEur(a.amount)}</span></span>
                          )}
                          <span>Detectada: {fmtDate(a.detectedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!isResolved && (
                            <>
                              {a.status !== 'INVESTIGATING' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'INVESTIGATING')} disabled={saving}>
                                  <Eye size={12} className="mr-1" />Investigar
                                </Button>
                              )}
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActionAlert(isShowingAction ? null : a.id)} disabled={saving}>
                                <ShieldCheck size={12} className="mr-1" />Resolver
                              </Button>
                            </>
                          )}
                          {isResolved && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'OPEN')} disabled={saving}>
                              Reabrir
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Resolution panel */}
                      {isShowingAction && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <Input
                            placeholder="Notas de resolución (opcional)..."
                            value={actionNotes}
                            onChange={e => setActionNotes(e.target.value)}
                            className="h-8 text-xs bg-muted border-border"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'RESOLVED')} disabled={saving}>
                              <ShieldCheck size={12} className="mr-1" />{saving ? 'Guardando...' : 'Marcar como resuelta'}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleResolve(a.id, 'FALSE_POSITIVE')} disabled={saving}>
                              <ShieldX size={12} className="mr-1" />Falso positivo
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setActionAlert(null); setActionNotes('') }}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                      {/* Resolution info */}
                      {res && isResolved && (
                        <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                          {a.status === 'FALSE_POSITIVE' ? 'Falso positivo' : 'Resuelta'} por <span className="font-medium text-foreground">{res.resolvedBy}</span> el {fmtDateTime(res.resolvedAt)}
                          {res.notes && <span> — {res.notes}</span>}
                        </div>
                      )}
                      {res && a.status === 'INVESTIGATING' && (
                        <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                          En investigación desde {fmtDateTime(res.updatedAt)}
                          {res.notes && <span> — {res.notes}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                {alerts.length > 10 && (
                  <div className="flex items-center justify-center gap-2 pt-3">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={alertPage === 0} onClick={() => setAlertPage(p => p - 1)}>←</Button>
                    {Array.from({ length: Math.ceil(alerts.length / 10) }, (_, i) => (
                      <button key={i} onClick={() => setAlertPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${alertPage === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
                    ))}
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={alertPage >= Math.ceil(alerts.length / 10) - 1} onClick={() => setAlertPage(p => p + 1)}>→</Button>
                    <span className="text-xs text-muted-foreground ml-2">{alertPage * 10 + 1}–{Math.min((alertPage + 1) * 10, alerts.length)} de {alerts.length}</span>
                  </div>
                )}
              </div>
            )
          )}

          {/* Anomalías tab */}
          {tab === 'anomalias' && (
            anomalies.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-3 opacity-30"><Search size={28} className="mx-auto text-muted-foreground" /></div>
                <div className="text-sm text-muted-foreground">No se han detectado anomalías</div>
                <div className="text-xs text-muted-foreground mt-1">Se analizan duplicados, pagos sin aprobación e impagos prolongados</div>
              </div>
            ) : (
              <>
              <ScrollableTable>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Tipo', 'Factura', 'Entidad', 'Descripción', 'Importe', 'Severidad', 'Fecha'].map(h => (
                        <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.slice(anomPage * 10, (anomPage + 1) * 10).map(a => {
                      const sev = severityConfig[a.severity] || severityConfig.LOW
                      return (
                        <tr key={a.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${a.severity === 'HIGH' ? 'bg-destructive/5' : ''}`}>
                          <td className="p-3 text-xs font-medium">{a.type}</td>
                          <td className="p-3 font-mono text-xs">{a.invoiceNumber}</td>
                          <td className="p-3 text-xs">{a.entity}</td>
                          <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{a.description}</td>
                          <td className="p-3 font-mono text-xs font-semibold">{fmtEur(a.amount)}</td>
                          <td className="p-3"><Badge variant={sev.variant}>{sev.label}</Badge></td>
                          <td className="p-3 text-xs text-muted-foreground">{fmtDate(a.detectedAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
</ScrollableTable>
              {anomalies.length > 10 && (
                <div className="flex items-center justify-center gap-2 p-3">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={anomPage === 0} onClick={() => setAnomPage(p => p - 1)}>←</Button>
                  {Array.from({ length: Math.ceil(anomalies.length / 10) }, (_, i) => (
                    <button key={i} onClick={() => setAnomPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${anomPage === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={anomPage >= Math.ceil(anomalies.length / 10) - 1} onClick={() => setAnomPage(p => p + 1)}>→</Button>
                  <span className="text-xs text-muted-foreground ml-2">{anomPage * 10 + 1}–{Math.min((anomPage + 1) * 10, anomalies.length)} de {anomalies.length}</span>
                </div>
              )}
              </>
            )
          )}

          {/* Auditoría tab */}
          {tab === 'audit' && (
            auditLog.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-3 opacity-30"><ClipboardList size={28} className="mx-auto text-muted-foreground" /></div>
                <div className="text-sm text-muted-foreground">No hay registros de auditoría</div>
                <div className="text-xs text-muted-foreground mt-1">Las acciones del sistema se registrarán aquí automáticamente</div>
              </div>
            ) : (
              <>
              <ScrollableTable>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Fecha', 'Usuario', 'Acción', 'Entidad', 'IP', 'Detalles'].map(h => (
                        <th key={h} className="text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.slice(auditPage * 10, (auditPage + 1) * 10).map((log: any) => (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-xs text-muted-foreground">{fmtDateTime(log.createdAt)}</td>
                        <td className="p-3 text-xs">{log.user?.email || '—'}</td>
                        <td className="p-3">
                          <Badge variant={log.action?.includes('DELETE') ? 'destructive' : log.action?.includes('CREATE') ? 'success' : 'secondary'}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">{log.entity} {log.entityId ? `(${log.entityId.slice(0, 8)}...)` : ''}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{log.ipAddress || '—'}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {log.oldValue || log.newValue ? 'Ver cambios' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</ScrollableTable>
              {auditLog.length > 10 && (
                <div className="flex items-center justify-center gap-2 p-3">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={auditPage === 0} onClick={() => setAuditPage(p => p - 1)}>←</Button>
                  {Array.from({ length: Math.ceil(auditLog.length / 10) }, (_, i) => (
                    <button key={i} onClick={() => setAuditPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${auditPage === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={auditPage >= Math.ceil(auditLog.length / 10) - 1} onClick={() => setAuditPage(p => p + 1)}>→</Button>
                  <span className="text-xs text-muted-foreground ml-2">{auditPage * 10 + 1}–{Math.min((auditPage + 1) * 10, auditLog.length)} de {auditLog.length}</span>
                </div>
              )}
              </>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
