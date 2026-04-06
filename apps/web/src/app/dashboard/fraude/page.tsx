'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import { useEffect, useState } from 'react'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { fmtEur, riskLabel, riskVariant, exportCSV } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Siren, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonFraude } from '@/components/ui/skeleton-page'
import { KpiBox } from '@/components/kpi-box'
import dynamic from 'next/dynamic'
import { FraudAlert, Anomaly, TabKey, severityConfig, alertTypeLabels, daysDiff } from './_components/types'

const AlertasTab = dynamic(() => import('./_components/alertas-tab').then(m => ({ default: m.AlertasTab })), { ssr: false })
const AnomaliasTab = dynamic(() => import('./_components/anomalias-tab').then(m => ({ default: m.AnomaliasTab })), { ssr: false })
const AuditoriaTab = dynamic(() => import('./_components/auditoria-tab').then(m => ({ default: m.AuditoriaTab })), { ssr: false })

export default function FraudePage() {
  const t = useTranslations('fraude')
  const [customers, setCustomers] = useState<any[]>([])
  const [invoicesAR, setInvoicesAR] = useState<any[]>([])
  const [invoicesAP, setInvoicesAP] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [resolutions, setResolutions] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const { filters: urlFilters, setFilters: setUrlFilters } = useUrlFilters({
    tab: 'alertas',
    anomPage: '0',
    auditPage: '0',
    alertPage: '0',
  })
  const tab = (urlFilters.tab as TabKey) || 'alertas'
  const setTab = (t: TabKey) => setUrlFilters({ tab: t, anomPage: '0', auditPage: '0', alertPage: '0' })
  const anomPage = parseInt(urlFilters.anomPage) || 0
  const setAnomPage = (v: number | ((p: number) => number)) => {
    const next = typeof v === 'function' ? v(anomPage) : v
    setUrlFilters({ anomPage: String(next) })
  }
  const auditPage = parseInt(urlFilters.auditPage) || 0
  const setAuditPage = (v: number | ((p: number) => number)) => {
    const next = typeof v === 'function' ? v(auditPage) : v
    setUrlFilters({ auditPage: String(next) })
  }
  const alertPage = parseInt(urlFilters.alertPage) || 0
  const setAlertPage = (v: number | ((p: number) => number)) => {
    const next = typeof v === 'function' ? v(alertPage) : v
    setUrlFilters({ alertPage: String(next) })
  }
  const [actionAlert, setActionAlert] = useState<string | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [anomAction, setAnomAction] = useState<string | null>(null)
  const [anomActing, setAnomActing] = useState(false)
  const [dismissedAnoms, setDismissedAnoms] = useState<Set<string>>(new Set())
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
        const dismissed = new Set<string>()
        res.forEach((r: any) => {
          resMap[r.alertId] = r
          if (r.status === 'FALSE_POSITIVE' && (r.alertId.startsWith('overdue-') || r.alertId.startsWith('dup-') || r.alertId.startsWith('large-ap-'))) {
            dismissed.add(r.alertId)
          }
        })
        setResolutions(resMap)
        setDismissedAnoms(dismissed)
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
      toast({ title: t('toastAlertUpdated'), description: status === 'RESOLVED' ? t('toastMarkedResolved') : status === 'FALSE_POSITIVE' ? t('toastMarkedFalsePositive') : status === 'INVESTIGATING' ? t('toastInvestigating') : t('toastReopened') })
      setActionAlert(null)
      setActionNotes('')
    } catch (err: any) {
      toast({ title: t('toastError'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonFraude />

  // ── Generate fraud alerts from real data ──
  const alerts: FraudAlert[] = []

  // 1. Customer risk alerts
  customers.forEach(c => {
    if (c.riskLevel === 'CRITICAL' || c.status === 'ALERT' || c.status === 'SUSPENDED') {
      alerts.push({
        id: `risk-${c.id}`,
        type: 'CUSTOMER_RISK',
        severity: c.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        title: t('alertCustomerRisk', { level: c.riskLevel === 'CRITICAL' ? t('riskCritical') : t('riskHigh'), name: c.name }),
        description: t('alertCustomerRiskDesc', { score: c.creditScore || 'N/A', status: c.status, dso: c.dso || 0 }),
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
        title: t('alertCreditExceeded', { name: c.name }),
        description: t('alertCreditExceededDesc', { exposure: fmtEur(exposure), limit: fmtEur(limit), pct: ((exposure / limit) * 100).toFixed(0) }),
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
      title: t('alertOverdueConcentration'),
      description: t('alertOverdueConcentrationDesc', { count: overdueAR.length, pct: ((overdueAmount / totalAR) * 100).toFixed(1) }),
      entity: t('arPortfolio'),
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
      title: t('alertHighPriorityUnapproved', { count: highPriorityUnapproved.length }),
      description: highPriorityUnapproved.map((i: any) => `${i.number} (${i.supplier?.name})`).join(', '),
      entity: t('accountsPayable'),
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
        type: t('anomalyProlongedDefault'),
        description: t('anomalyProlongedDefaultDesc', { days, name: i.customer?.name }),
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
  invoicesAP.filter((i: any) => i.status !== 'REJECTED').forEach((i: any) => {
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
            type: t('anomalyPossibleDuplicate'),
            description: t('anomalyPossibleDuplicateDesc', { supplier: group[i].supplier?.name }),
            invoiceNumber: `${group[i].number} / ${group[j].number}`,
            entity: group[i].supplier?.name || '',
            amount: amtA,
            severity: 'MEDIUM',
            detectedAt: group[j].issueDate,
            invoiceIds: [group[i].id, group[j].id],
            actionable: true,
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
        type: t('anomalyLargeUnapproved'),
        description: t('anomalyLargeUnapprovedDesc', { number: i.number, supplier: i.supplier?.name, amount: fmtEur(amt) }),
        invoiceNumber: i.number,
        entity: i.supplier?.name || '',
        amount: amt,
        severity: amt > 100000 ? 'HIGH' : 'MEDIUM',
        detectedAt: i.createdAt || i.issueDate,
        invoiceIds: [i.id],
        actionable: true,
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

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'alertas', label: t('tabAlerts'), count: alerts.length },
    { key: 'anomalias', label: t('tabAnomalies'), count: anomalies.length },
    { key: 'audit', label: t('tabAudit'), count: auditLog.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCSV('fraude_alertas', [t('csvSeverity'), t('csvType'), t('csvTitle'), t('csvDescription'), t('csvEntity'), t('csvAmount'), t('csvStatus'), t('csvDate')], alerts.map(a => [a.severity, alertTypeLabels[a.type] || a.type, a.title, a.description, a.entity, a.amount || '', a.status, a.detectedAt?.slice(0, 10)]))}><Download size={14} className="mr-1" />{t('export')}</Button>
        }
      />

      {/* Critical banner */}
      {criticalAlerts > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Siren size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">{t('criticalBanner', { count: criticalAlerts })}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {alerts.filter(a => a.severity === 'CRITICAL').map(a => a.title).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpiOpenAlerts'), value: `${openAlerts}`, color: openAlerts > 0 ? 'text-destructive' : 'text-success' },
          { label: t('kpiExposureAtRisk'), value: fmtEur(totalExposure), color: totalExposure > 0 ? 'text-warning' : 'text-foreground' },
          { label: t('kpiRiskCustomers'), value: `${riskCustomers.length}/${customers.length}`, color: riskCustomers.length > 0 ? 'text-destructive' : 'text-success' },
          { label: t('kpiComplianceScore'), value: `${complianceScore}%`, color: complianceScore >= 80 ? 'text-success' : complianceScore >= 60 ? 'text-warning' : 'text-destructive' },
        ].map((m, i) => (
          <KpiBox key={m.label} index={i} label={m.label} value={m.value} color={m.color} />
        ))}
      </div>

      {/* Risk matrix + Compliance breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alert distribution by type */}
        <Card>
          <CardHeader><CardTitle>{t('alertDistribution')}</CardTitle></CardHeader>
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
                      <span className="text-muted-foreground">{t('alertCount', { count })}</span>
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
                <div className="text-sm text-muted-foreground">{t('noActiveAlerts')}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance factors */}
        <Card>
          <CardHeader><CardTitle>{t('complianceFactors')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: t('complianceScoringCoverage'),
                description: t('complianceScoringCoverageDesc', { evaluated: customers.filter(c => c.creditScore !== null).length, total: customers.length }),
                value: complianceFactors[0],
              },
              {
                label: t('complianceCollectionHealth'),
                description: t('complianceCollectionHealthDesc', { overdue: overdueAR.length, total: invoicesAR.length }),
                value: complianceFactors[1],
              },
              {
                label: t('complianceApApprovals'),
                description: t('complianceApApprovalsDesc', { approved: invoicesAP.filter((i: any) => i.approvedBy).length, total: invoicesAP.length }),
                value: complianceFactors[2],
              },
              {
                label: t('complianceTraceability'),
                description: auditLog.length > 0 ? t('complianceTraceabilityDesc', { count: auditLog.length }) : t('complianceNoRecords'),
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
              <CardTitle>{t('watchlistCustomers')}</CardTitle>
              <Badge variant="destructive">{t('customerCount', { count: riskCustomers.length })}</Badge>
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
                          <span className="text-muted-foreground">{t('creditScore')}</span>
                          <span className={`font-mono font-bold ${(c.creditScore || 0) < 40 ? 'text-destructive' : 'text-warning'}`}>{c.creditScore || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{t('exposure')}</span>
                          <span className="font-mono font-semibold">{fmtEur(exposure)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{t('overdueInvoices')}</span>
                          <span className={`font-mono font-semibold ${overdueCount > 0 ? 'text-destructive' : 'text-success'}`}>{overdueCount}</span>
                        </div>
                        {limit > 0 && (
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{t('creditUsage')}</span>
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
            <CardTitle>{t('detail')}</CardTitle>
            <div className="pill-tabs">
              {tabs.map(t2 => (
                <button
                  key={t2.key}
                  onClick={() => setTab(t2.key)}
                  className={`${tab === t2.key ? 'pill-tab-active' : 'pill-tab'} pill-tab-xs`}
                >
                  {t2.label} ({t2.count})
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Alertas tab */}
          {tab === 'alertas' && (
            <AlertasTab
              alerts={alerts}
              resolutions={resolutions}
              alertPage={alertPage}
              setAlertPage={setAlertPage}
              actionAlert={actionAlert}
              setActionAlert={setActionAlert}
              actionNotes={actionNotes}
              setActionNotes={setActionNotes}
              saving={saving}
              handleResolve={handleResolve}
              fmtDate={fmtDate}
              fmtDateTime={fmtDateTime}
              fmtEur={fmtEur}
            />
          )}

          {/* Anomalías tab */}
          {tab === 'anomalias' && (
            <AnomaliasTab
              anomalies={anomalies}
              invoicesAP={invoicesAP}
              anomPage={anomPage}
              setAnomPage={setAnomPage}
              anomAction={anomAction}
              setAnomAction={setAnomAction}
              anomActing={anomActing}
              setAnomActing={setAnomActing}
              dismissedAnoms={dismissedAnoms}
              setDismissedAnoms={setDismissedAnoms}
              fetchData={fetchData}
              fmtDate={fmtDate}
              fmtEur={fmtEur}
              toast={toast}
            />
          )}

          {/* Auditoría tab */}
          {tab === 'audit' && (
            <AuditoriaTab
              auditLog={auditLog}
              auditPage={auditPage}
              setAuditPage={setAuditPage}
              fmtDateTime={fmtDateTime}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
