'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { useHydrated } from '@/hooks/use-hydrated'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonConfiguracion } from '@/components/ui/skeleton-page'
import { Building2, Target, Bell, TrendingUp, Shield, Save, RotateCcw, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/page-header'

interface Tenant {
  id: string; name: string; nif: string; sector: string | null; slug: string; logo: string | null; currency: string; locale: string
}

interface Config {
  kpiTargets: { dsoTarget: number; dpoTarget: number; cccTarget: number; ebitdaMarginTarget: number; liquidezMinima: number }
  covenantAlerts: { warningThreshold: number; criticalThreshold: number }
  forecast: { horizonWeeks: number; gapAlertEnabled: boolean; scenarioDefault: string }
  scoring: { alertScoreThreshold: number; riskAutoSuspend: boolean }
  notifications: { emailEnabled: boolean; overdueAlertDays: number; apDueSoonDays: number }
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <div className="flex-shrink-0 w-48">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function ConfiguracionPage() {
  const t = useTranslations('configuracion')
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('empresa')
  const [saving, setSaving] = useState(false)

  // Tenant form
  const [tName, setTName] = useState('')
  const [tNif, setTNif] = useState('')
  const [tSector, setTSector] = useState('')
  const [tCurrency, setTCurrency] = useState('EUR')
  const [tLocale, setTLocale] = useState('es-ES')

  const { toast } = useToast()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)
  const savedConfigRef = useRef<string>('')
  const savedTenantRef = useRef<string>('')

  useUnsavedChanges(dirty)

  const SECTIONS = [
    { key: 'empresa', label: t('sectionCompany'), icon: <Building2 size={14} /> },
    { key: 'kpis', label: t('sectionKpiThresholds'), icon: <Target size={14} /> },
    { key: 'covenants', label: t('sectionCovenants'), icon: <Shield size={14} /> },
    { key: 'forecast', label: t('sectionForecast'), icon: <TrendingUp size={14} /> },
    { key: 'notificaciones', label: t('sectionNotifications'), icon: <Bell size={14} /> },
    { key: 'tour', label: t('sectionGuidedTour'), icon: <Sparkles size={14} /> },
  ]

  // Track changes by comparing current state to saved snapshot
  useEffect(() => {
    const currentTenant = JSON.stringify({ tName, tNif, tSector, tCurrency, tLocale })
    const currentConfig = JSON.stringify(config)
    const tenantChanged = savedTenantRef.current !== '' && currentTenant !== savedTenantRef.current
    const configChanged = savedConfigRef.current !== '' && currentConfig !== savedConfigRef.current
    setDirty(tenantChanged || configChanged)
  }, [tName, tNif, tSector, tCurrency, tLocale, config])

  const loadData = useCallback(() => {
    return Promise.all([api.settings.getTenant(), api.settings.getConfig()])
      .then(([t, c]) => {
        setTenant(t)
        setConfig(c)
        setTName(t.name)
        setTNif(t.nif)
        setTSector(t.sector || '')
        setTCurrency(t.currency || 'EUR')
        setTLocale(t.locale || 'es-ES')
        // Save snapshots for dirty tracking
        savedTenantRef.current = JSON.stringify({ tName: t.name, tNif: t.nif, tSector: t.sector || '', tCurrency: t.currency || 'EUR', tLocale: t.locale || 'es-ES' })
        savedConfigRef.current = JSON.stringify(c)
        setDirty(false)
      })
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const hydrated = useHydrated()

  if (!hydrated || loading || !config) return <SkeletonConfiguracion />

  function updateConfig(path: string, value: any) {
    setConfig(prev => {
      if (!prev) return prev
      const parts = path.split('.')
      const next = JSON.parse(JSON.stringify(prev))
      let obj = next
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]]
      obj[parts[parts.length - 1]] = value
      return next
    })
  }

  async function saveTenant() {
    setSaving(true)
    try {
      await api.settings.updateTenant({ name: tName, nif: tNif, sector: tSector || null, currency: tCurrency, locale: tLocale })
      toast({ title: t('toastDataSavedTitle'), description: t('toastDataSavedDesc') })
      savedTenantRef.current = JSON.stringify({ tName, tNif, tSector, tCurrency, tLocale })
      setDirty(false)
      loadData()
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function saveConfig() {
    setSaving(true)
    try {
      await api.settings.updateConfig(config)
      toast({ title: t('toastConfigSavedTitle'), description: t('toastConfigSavedDesc') })
      savedConfigRef.current = JSON.stringify(config)
      setDirty(false)
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={dirty ? t('unsavedChanges') : t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={loadData}
      />

      {/* Section nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeSection === s.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Empresa */}
      {activeSection === 'empresa' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Building2 size={18} />
                <CardTitle>{t('companyDataTitle')}</CardTitle>
              </div>
              <Button size="sm" onClick={saveTenant} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('companyNameLabel')} desc={t('companyNameDesc')}>
              <Input value={tName} onChange={e => setTName(e.target.value)} className="h-8 text-sm" />
            </Field>
            <Field label={t('nifLabel')} desc={t('nifDesc')}>
              <Input value={tNif} onChange={e => setTNif(e.target.value)} className="h-8 text-sm" />
            </Field>
            <Field label={t('sectorLabel')} desc={t('sectorDesc')}>
              <Input value={tSector} onChange={e => setTSector(e.target.value)} className="h-8 text-sm" placeholder={t('sectorPlaceholder')} />
            </Field>
            <Field label={t('currencyLabel')} desc={t('currencyDesc')}>
              <select value={tCurrency} onChange={e => setTCurrency(e.target.value)} className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm">
                <option value="EUR">{t('currencyEur')}</option>
                <option value="USD">{t('currencyUsd')}</option>
                <option value="GBP">{t('currencyGbp')}</option>
              </select>
            </Field>
            <Field label={t('languageLabel')} desc={t('languageDesc')}>
              <select value={tLocale} onChange={e => setTLocale(e.target.value)} className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm">
                <option value="es-ES">{t('langSpanish')}</option>
                <option value="en-US">{t('langEnglish')}</option>
                <option value="pt-BR">{t('langPortuguese')}</option>
              </select>
            </Field>
            <Field label={t('slugLabel')} desc={t('slugDesc')}>
              <div className="h-8 flex items-center px-2 rounded-md bg-muted text-sm text-muted-foreground font-mono">{tenant?.slug}</div>
            </Field>
          </CardContent>
        </Card>
      )}

      {/* KPI Targets */}
      {activeSection === 'kpis' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Target size={18} />
                <CardTitle>{t('kpiThresholdsTitle')}</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('dsoTargetLabel')} desc={t('dsoTargetDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={120} value={config.kpiTargets.dsoTarget} onChange={e => updateConfig('kpiTargets.dsoTarget', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
              </div>
            </Field>
            <Field label={t('dpoTargetLabel')} desc={t('dpoTargetDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={180} value={config.kpiTargets.dpoTarget} onChange={e => updateConfig('kpiTargets.dpoTarget', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
              </div>
            </Field>
            <Field label={t('cccTargetLabel')} desc={t('cccTargetDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={-30} max={120} value={config.kpiTargets.cccTarget} onChange={e => updateConfig('kpiTargets.cccTarget', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
              </div>
            </Field>
            <Field label={t('ebitdaMarginLabel')} desc={t('ebitdaMarginDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={100} step={0.1} value={config.kpiTargets.ebitdaMarginTarget} onChange={e => updateConfig('kpiTargets.ebitdaMarginTarget', parseFloat(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label={t('liquidityRatioLabel')} desc={t('liquidityRatioDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={0.1} max={5} step={0.05} value={config.kpiTargets.liquidezMinima} onChange={e => updateConfig('kpiTargets.liquidezMinima', parseFloat(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">x</span>
              </div>
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Covenants */}
      {activeSection === 'covenants' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Shield size={18} />
                <CardTitle>{t('covenantAlertsTitle')}</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('warningThresholdLabel')} desc={t('warningThresholdDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={50} value={config.covenantAlerts.warningThreshold} onChange={e => updateConfig('covenantAlerts.warningThreshold', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label={t('criticalThresholdLabel')} desc={t('criticalThresholdDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={50} value={config.covenantAlerts.criticalThreshold} onChange={e => updateConfig('covenantAlerts.criticalThreshold', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
              {t('covenantExplanation', { warning: config.covenantAlerts.warningThreshold, critical: config.covenantAlerts.criticalThreshold })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast */}
      {activeSection === 'forecast' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} />
                <CardTitle>{t('forecastConfigTitle')}</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('forecastHorizonLabel')} desc={t('forecastHorizonDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={4} max={52} value={config.forecast.horizonWeeks} onChange={e => updateConfig('forecast.horizonWeeks', parseInt(e.target.value) || 13)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">{t('unitWeeks')}</span>
              </div>
            </Field>
            <Field label={t('defaultScenarioLabel')} desc={t('defaultScenarioDesc')}>
              <select value={config.forecast.scenarioDefault} onChange={e => updateConfig('forecast.scenarioDefault', e.target.value)} className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm">
                <option value="BASE">{t('scenarioBase')}</option>
                <option value="CONSERVADOR">{t('scenarioConservative')}</option>
                <option value="AGRESIVO">{t('scenarioAggressive')}</option>
              </select>
            </Field>
            <Field label={t('gapAlertsLabel')} desc={t('gapAlertsDesc')}>
              <Toggle checked={config.forecast.gapAlertEnabled} onChange={v => updateConfig('forecast.gapAlertEnabled', v)} />
            </Field>
            <Field label={t('customerAlertScoreLabel')} desc={t('customerAlertScoreDesc')}>
              <Input type="number" min={0} max={100} value={config.scoring.alertScoreThreshold} onChange={e => updateConfig('scoring.alertScoreThreshold', parseInt(e.target.value) || 50)} className="h-8 text-sm font-mono" />
            </Field>
            <Field label={t('autoSuspendLabel')} desc={t('autoSuspendDesc')}>
              <Toggle checked={config.scoring.riskAutoSuspend} onChange={v => updateConfig('scoring.riskAutoSuspend', v)} />
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Notificaciones */}
      {activeSection === 'notificaciones' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Bell size={18} />
                <CardTitle>{t('notificationPrefsTitle')}</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('emailNotificationsLabel')} desc={t('emailNotificationsDesc')}>
              <Toggle checked={config.notifications.emailEnabled} onChange={v => updateConfig('notifications.emailEnabled', v)} />
            </Field>
            <Field label={t('overdueAlertDaysLabel')} desc={t('overdueAlertDaysDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={90} value={config.notifications.overdueAlertDays} onChange={e => updateConfig('notifications.overdueAlertDays', parseInt(e.target.value) || 3)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
              </div>
            </Field>
            <Field label={t('apDueSoonDaysLabel')} desc={t('apDueSoonDaysDesc')}>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={30} value={config.notifications.apDueSoonDays} onChange={e => updateConfig('notifications.apDueSoonDays', parseInt(e.target.value) || 3)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
              </div>
            </Field>
          </CardContent>
        </Card>
      )}

      {activeSection === 'tour' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <CardTitle>{t('guidedTourTitle')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('guidedTourDesc')}
              </p>
              <Button
                onClick={() => {
                  localStorage.removeItem('geacfo-onboarding-completed')
                  window.location.href = '/dashboard/cockpit'
                }}
              >
                <Sparkles size={14} className="mr-2" />
                {t('relaunchTour')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
