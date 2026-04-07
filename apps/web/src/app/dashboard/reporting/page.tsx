'use client'
import { useHydrated } from '@/hooks/use-hydrated'
import React, { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { KpiBox } from '@/components/kpi-box'
import { exportBoardPackPDF } from '@/lib/export-pdf'
import { Plus, Send, Pencil, Trash2, Clock, CheckCircle2, Pause, Play, FileDown, Calendar, Mail, Landmark, TrendingUp, TrendingDown, Shield, Users, Target, AlertTriangle, Bell } from 'lucide-react'
import { PillTabs } from '@/components/ui/pill-tabs'
import { useCockpit, useForecastCompare, useSuppliers, useDebtSummary, useAlertCounts } from '@/hooks/use-api'
import { fmtEur, fmtPct } from '@/lib/utils'

interface Schedule {
  id: string; name: string; reportType: string; frequency: string; recipients: string
  enabled: boolean; lastSentAt: string | null; nextRunAt: string | null; createdBy: string; createdAt: string
}

export default function ReportingPage() {
  const t = useTranslations('reporting')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'schedules' | 'dashboard'>('schedules')
  const [selectedKpis, setSelectedKpis] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['cash_balance', 'ar_total', 'ap_total', 'coverage_ratio']
    try {
      const saved = localStorage.getItem('geacfo-custom-dashboard')
      return saved ? JSON.parse(saved) : ['cash_balance', 'ar_total', 'ap_total', 'coverage_ratio']
    } catch { return ['cash_balance', 'ar_total', 'ap_total', 'coverage_ratio'] }
  })
  const [dashPeriod, setDashPeriod] = useState('30d')

  // Form
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('board_pack')
  const [formFreq, setFormFreq] = useState('monthly')
  const [formRecipients, setFormRecipients] = useState('')

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  const REPORT_TYPES: Record<string, { label: string; desc: string }> = {
    board_pack: { label: t('reportTypeBoardPack'), desc: t('reportTypeBoardPackDesc') },
    cockpit_summary: { label: t('reportTypeCockpitSummary'), desc: t('reportTypeCockpitSummaryDesc') },
    forecast_report: { label: t('reportTypeForecast'), desc: t('reportTypeForecastDesc') },
    debt_covenants: { label: t('reportTypeDebtCovenants'), desc: t('reportTypeDebtCovenantsDesc') },
  }

  const FREQUENCIES: Record<string, { label: string; desc: string }> = {
    weekly: { label: t('freqWeekly'), desc: t('freqWeeklyDesc') },
    biweekly: { label: t('freqBiweekly'), desc: t('freqBiweeklyDesc') },
    monthly: { label: t('freqMonthly'), desc: t('freqMonthlyDesc') },
    quarterly: { label: t('freqQuarterly'), desc: t('freqQuarterlyDesc') },
  }

  const load = useCallback(() => {
    api.reporting.list()
      .then(d => { setSchedules(d); setLastUpdated(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('geacfo-custom-dashboard', JSON.stringify(selectedKpis))
    }
  }, [selectedKpis])

  // Data hooks for custom dashboard (only fetch when dashboard tab is active)
  const { data: cockpit } = useCockpit()
  const { data: forecastCompare } = useForecastCompare()
  const { data: suppliersList } = useSuppliers()
  const { data: debtData } = useDebtSummary()
  const { data: alertCounts } = useAlertCounts()

  // Compute KPI values from API data
  const kpiValues: Record<string, string> = {}
  if (cockpit) {
    kpiValues.cash_balance = fmtEur(cockpit.caja?.value ?? 0)
    kpiValues.ar_total = fmtEur(cockpit.workingCapital?.ar ?? 0)
    kpiValues.ap_total = fmtEur(cockpit.workingCapital?.ap ?? 0)
    kpiValues.coverage_ratio = cockpit.liquidez?.value != null ? `${cockpit.liquidez.value}x` : '—'
  }
  if (suppliersList && suppliersList.length > 0) {
    const scored = suppliersList.filter((s: any) => s.overallScore != null)
    kpiValues.supplier_score = scored.length > 0
      ? String(Math.round(scored.reduce((sum: number, s: any) => sum + s.overallScore, 0) / scored.length))
      : '—'
  }
  if (forecastCompare) {
    const baseWeeks = forecastCompare.weeks?.filter((w: any) => w.base) || []
    if (baseWeeks.length > 0) {
      const avg = Math.round(baseWeeks.reduce((s: number, w: any) => s + w.base.confidence, 0) / baseWeeks.length)
      kpiValues.forecast_confidence = `${avg}%`
    }
  }
  if (debtData) {
    const atRisk = debtData.covenants?.filter((c: any) => c.status === 'WARNING' || c.status === 'BREACH')?.length ?? 0
    kpiValues.covenants_risk = String(atRisk)
  }
  if (alertCounts) {
    const total = Object.values(alertCounts).reduce((s: number, v: any) => s + (typeof v === 'number' ? v : 0), 0)
    kpiValues.active_alerts = String(total)
  }

  const AVAILABLE_KPIS: { key: string; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'cash_balance', label: t('kpiCashBalance'), icon: <Landmark size={16} />, color: 'text-primary' },
    { key: 'ar_total', label: t('kpiArTotal'), icon: <TrendingUp size={16} />, color: 'text-success' },
    { key: 'ap_total', label: t('kpiApTotal'), icon: <TrendingDown size={16} />, color: 'text-destructive' },
    { key: 'coverage_ratio', label: t('kpiCoverageRatio'), icon: <Shield size={16} />, color: 'text-primary' },
    { key: 'supplier_score', label: t('kpiSupplierScore'), icon: <Users size={16} />, color: 'text-warning' },
    { key: 'forecast_confidence', label: t('kpiForecastConf'), icon: <Target size={16} />, color: 'text-success' },
    { key: 'covenants_risk', label: t('kpiCovenantsRisk'), icon: <AlertTriangle size={16} />, color: 'text-destructive' },
    { key: 'active_alerts', label: t('kpiActiveAlerts'), icon: <Bell size={16} />, color: 'text-warning' },
  ]

  function toggleKpi(key: string) {
    setSelectedKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const hydrated = useHydrated()

  if (!hydrated || loading) return <SkeletonKPIsAndTable cols={5} rows={3} />

  function openCreate() {
    setEditSchedule(null)
    setFormName('')
    setFormType('board_pack')
    setFormFreq('monthly')
    setFormRecipients('')
    setDialogOpen(true)
  }

  function openEdit(s: Schedule) {
    setEditSchedule(s)
    setFormName(s.name)
    setFormType(s.reportType)
    setFormFreq(s.frequency)
    setFormRecipients(s.recipients)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formRecipients.trim()) {
      toast({ title: t('toastErrorTitle'), description: t('toastNameRecipientsRequired'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editSchedule) {
        await api.reporting.update(editSchedule.id, { name: formName, frequency: formFreq, recipients: formRecipients })
        toast({ title: t('toastScheduleUpdated') })
      } else {
        await api.reporting.create({ name: formName, reportType: formType, frequency: formFreq, recipients: formRecipients })
        toast({ title: t('toastScheduleCreated'), description: t('toastScheduleCreatedDesc', { name: formName, frequency: FREQUENCIES[formFreq]?.label.toLowerCase() }) })
      }
      setDialogOpen(false)
      load()
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(s: Schedule) {
    try {
      await api.reporting.update(s.id, { enabled: !s.enabled })
      toast({ title: s.enabled ? t('toastSchedulePaused') : t('toastScheduleActivated') })
      load()
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    }
  }

  async function handleSendNow(s: Schedule) {
    setSending(s.id)
    try {
      // Generate board pack and trigger PDF download
      if (s.reportType === 'board_pack') {
        const data = await api.board.pack()
        exportBoardPackPDF(data)
      }
      await api.reporting.send(s.id)
      toast({ title: t('toastReportGenerated'), description: t('toastReportGeneratedDesc', { name: s.name }) })
      load()
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setSending(null)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      await api.reporting.remove(deleteConfirm.id)
      toast({ title: t('toastScheduleDeleted') })
      setDeleteConfirm(null)
      load()
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
      setDeleteConfirm(null)
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return t('never')
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function fmtRelative(d: string | null) {
    if (!d) return '—'
    const date = new Date(d)
    const now = new Date()
    const diffD = Math.ceil((date.getTime() - now.getTime()) / 86400000)
    if (diffD < 0) return t('overdue')
    if (diffD === 0) return t('today')
    if (diffD === 1) return t('tomorrow')
    if (diffD < 7) return t('inDays', { count: diffD })
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }

  const activeCount = schedules.filter(s => s.enabled).length
  const totalRecipients = new Set(schedules.flatMap(s => s.recipients.split(',').map(e => e.trim()))).size

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: schedules.length })}
        lastUpdated={lastUpdated}
        onRefresh={load}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1" />{t('newSchedule')}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpiSchedules'), value: schedules.length, icon: <Calendar size={14} /> },
          { label: t('kpiActive'), value: activeCount, icon: <Play size={14} />, color: 'text-success' },
          { label: t('kpiRecipients'), value: totalRecipients, icon: <Mail size={14} /> },
          { label: t('kpiLastSent'), value: schedules.filter(s => s.lastSentAt).length > 0 ? fmtRelative(schedules.filter(s => s.lastSentAt).sort((a, b) => new Date(b.lastSentAt!).getTime() - new Date(a.lastSentAt!).getTime())[0].lastSentAt) : t('never'), icon: <Send size={14} /> },
        ].map((m, i) => (
          <KpiBox key={m.label} index={i} label={m.label} value={m.value} icon={m.icon} color={m.color || ''} />
        ))}
      </div>

      {/* Tab toggle */}
      <PillTabs
        tabs={[
          { key: 'schedules', label: t('tabSchedules') },
          { key: 'dashboard', label: t('tabDashboard') },
        ]}
        active={tab}
        onChange={(key) => setTab(key as 'schedules' | 'dashboard')}
      />

      {tab === 'schedules' && (<>
      {/* SMTP notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Mail size={16} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">{t('smtpNoticeTitle')}</strong> {t('smtpNoticeDesc')}
        </div>
      </div>

      {/* Schedules list */}
      {schedules.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              variant="schedule"
              title={t('emptyState')}
              description="Programa informes automáticos para recibirlos periódicamente"
              action={{ label: t('createFirstSchedule'), onClick: openCreate }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => {
            const rtCfg = REPORT_TYPES[s.reportType] || { label: s.reportType, desc: '' }
            const frCfg = FREQUENCIES[s.frequency] || { label: s.frequency, desc: '' }
            return (
              <Card key={s.id} className={!s.enabled ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <FileDown size={20} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm">{s.name}</span>
                        <Badge variant={s.enabled ? 'success' : 'secondary'}>{s.enabled ? t('badgeActive') : t('badgePaused')}</Badge>
                        <Badge variant="outline" className="text-[10px]">{rtCfg.label}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{frCfg.label}</Badge>
                      </div>

                      <div className="text-xs text-muted-foreground mb-2">{rtCfg.desc}</div>

                      {/* Recipients */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Mail size={10} className="text-muted-foreground" />
                        {s.recipients.split(',').map(email => (
                          <Badge key={email.trim()} variant="secondary" className="text-[10px] font-mono">{email.trim()}</Badge>
                        ))}
                      </div>

                      {/* Timing */}
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {t('nextSend')}: <strong className="text-foreground">{s.enabled ? fmtRelative(s.nextRunAt) : t('paused')}</strong>
                        </span>
                        {s.lastSentAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-success" />
                            {t('lastSent')}: {fmtDate(s.lastSentAt)}
                          </span>
                        )}
                        <span>{t('createdBy')}: {s.createdBy}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleSendNow(s)}
                        disabled={sending === s.id}
                      >
                        <Send size={12} />{sending === s.id ? t('generating') : t('sendNow')}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleToggle(s)}>
                        {s.enabled ? <Pause size={14} /> : <Play size={14} />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openEdit(s)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(s)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      </>)}

      {tab === 'dashboard' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{t('dashPeriod')}:</span>
            <div className="flex gap-1">
              {[
                { key: '7d', label: '7 dias' },
                { key: '30d', label: '30 dias' },
                { key: '90d', label: '90 dias' },
                { key: '12m', label: '12 meses' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setDashPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dashPeriod === p.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('dashSelectKpis')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {AVAILABLE_KPIS.map(kpi => {
                  const selected = selectedKpis.includes(kpi.key)
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => toggleKpi(kpi.key)}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                        selected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                          : 'border-border bg-muted/30 hover:bg-muted/50 opacity-60'
                      }`}
                    >
                      <div className={`${selected ? kpi.color : 'text-muted-foreground'}`}>{kpi.icon}</div>
                      <span className="text-xs font-medium">{kpi.label}</span>
                      {selected && <CheckCircle2 size={12} className="ml-auto text-primary" />}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected KPIs dashboard */}
          {selectedKpis.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedKpis.map(key => {
                const kpi = AVAILABLE_KPIS.find(k => k.key === key)
                if (!kpi) return null
                return (
                  <Card key={key} className="relative overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={kpi.color}>{kpi.icon}</div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{kpi.label}</span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-foreground">{kpiValues[key] || '—'}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{t('dashPeriodLabel', { period: dashPeriod })}</div>
                      <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.03]">
                        {kpi.icon}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-sm text-muted-foreground">{t('dashNoKpis')}</div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Target size={16} className="text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">{t('dashHintTitle')}</strong> {t('dashHintDesc')}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editSchedule ? t('dialogEditTitle') : t('dialogCreateTitle')}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('fieldName')} *</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('fieldNamePlaceholder')} />
            </div>

            {!editSchedule && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('fieldReportType')} *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(REPORT_TYPES).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setFormType(key)}
                      className={`p-3 rounded-lg border text-left transition-colors ${formType === key ? 'border-primary bg-primary/10' : 'border-border bg-muted/50 hover:bg-muted'}`}
                    >
                      <div className="text-xs font-semibold">{cfg.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{cfg.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('fieldFrequency')} *</label>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(FREQUENCIES).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFormFreq(key)}
                    className={`p-2 rounded-lg border text-center transition-colors ${formFreq === key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'}`}
                  >
                    <div className="text-[10px] font-semibold">{cfg.label}</div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{FREQUENCIES[formFreq]?.desc}</div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('fieldRecipients')} * <span className="text-[10px]">({t('fieldRecipientsHint')})</span></label>
              <Input
                value={formRecipients}
                onChange={e => setFormRecipients(e.target.value)}
                placeholder="cfo@empresa.es, consejo@empresa.es"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : editSchedule ? t('saveChanges') : t('createSchedule')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialogDesc', { name: deleteConfirm?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
