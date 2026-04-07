'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api'
import { tenantSchema, configSchema, type TenantForm, type ConfigForm } from '@/lib/validations'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { useHydrated } from '@/hooks/use-hydrated'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonConfiguracion } from '@/components/ui/skeleton-page'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FieldError } from '@/components/ui/field-error'
import { Building2, Target, Bell, TrendingUp, Shield, Save, RotateCcw, Sparkles, Sun, Upload, GitBranch, Plus, Trash2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { PageHeader } from '@/components/page-header'
import { useRole } from '@/hooks/use-role'
import { AccessDenied } from '@/components/ui/access-denied'
import { useSocket } from '@/providers/socket-provider'

interface Tenant {
  id: string; name: string; nif: string; sector: string | null; slug: string; logo: string | null; currency: string; locale: string
}

const MOCK_BANKS = [
  { id: 'bbva', name: 'BBVA', logo: '\u{1F3E6}', color: '#004481' },
  { id: 'santander', name: 'Santander', logo: '\u{1F534}', color: '#EC0000' },
  { id: 'caixabank', name: 'CaixaBank', logo: '\u2B50', color: '#007EAE' },
  { id: 'sabadell', name: 'Banco Sabadell', logo: '\u{1F535}', color: '#0064A0' },
  { id: 'bankinter', name: 'Bankinter', logo: '\u{1F7E0}', color: '#FF6600' },
  { id: 'ing', name: 'ING', logo: '\u{1F7E7}', color: '#FF6200' },
  { id: 'deutsche', name: 'Deutsche Bank', logo: '\u{1F537}', color: '#0018A8' },
  { id: 'unicredit', name: 'UniCredit', logo: '\u{1F3DB}\uFE0F', color: '#E40521' },
]

const defaultApprovalLevels = [
  { role: 'ANALYST', label: 'Analyst', minAmount: 0, enabled: true },
  { role: 'CONTROLLER', label: 'Controller', minAmount: 10000, enabled: true },
  { role: 'CFO', label: 'CFO', minAmount: 50000, enabled: true },
]

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

export default function ConfiguracionPage() {
  const t = useTranslations('configuracion')
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('empresa')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const { pushPermission, requestPushPermission } = useSocket()

  const [approvalLevels, setApprovalLevels] = useState<Array<{ role: string; label: string; minAmount: number; enabled: boolean }>>(() => {
    if (typeof window === 'undefined') return defaultApprovalLevels
    try { return JSON.parse(localStorage.getItem('geacfo-approval-levels') || 'null') || defaultApprovalLevels } catch { return defaultApprovalLevels }
  })

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('geacfo-approval-levels', JSON.stringify(approvalLevels))
  }, [approvalLevels])

  const [bankConnections, setBankConnections] = useState<Array<{ id: string; bank: string; iban: string; status: 'connected' | 'syncing' | 'error'; lastSync: string | null }>>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('geacfo-bank-connections') || '[]') } catch { return [] }
  })
  const [showBankConnect, setShowBankConnect] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [connectingBank, setConnectingBank] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('geacfo-bank-connections', JSON.stringify(bankConnections))
  }, [bankConnections])

  const tenantForm = useForm<TenantForm>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { name: '', nif: '', sector: '', currency: 'EUR', locale: 'es-ES' },
  })

  const configForm = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      kpiTargets: { dsoTarget: 45, dpoTarget: 60, cccTarget: 30, ebitdaMarginTarget: 15, liquidezMinima: 1.2 },
      covenantAlerts: { warningThreshold: 15, criticalThreshold: 5 },
      forecast: { horizonWeeks: 13, gapAlertEnabled: true, scenarioDefault: 'BASE' },
      scoring: { alertScoreThreshold: 50, riskAutoSuspend: false },
      notifications: { emailEnabled: true, overdueAlertDays: 3, apDueSoonDays: 3 },
    },
  })

  const dirty = tenantForm.formState.isDirty || configForm.formState.isDirty
  useUnsavedChanges(dirty)

  const SECTIONS = [
    { key: 'empresa', label: t('sectionCompany'), icon: <Building2 size={14} /> },
    { key: 'kpis', label: t('sectionKpiThresholds'), icon: <Target size={14} /> },
    { key: 'covenants', label: t('sectionCovenants'), icon: <Shield size={14} /> },
    { key: 'forecast', label: t('sectionForecast'), icon: <TrendingUp size={14} /> },
    { key: 'notificaciones', label: t('sectionNotifications'), icon: <Bell size={14} /> },
    { key: 'bancos', label: t('tabBancos'), icon: <Building2 size={14} /> },
    { key: 'aprobaciones', label: t('approvalTitle'), icon: <GitBranch size={14} /> },
    { key: 'apariencia', label: t('sectionAppearance'), icon: <Sun size={14} /> },
    { key: 'tour', label: t('sectionGuidedTour'), icon: <Sparkles size={14} /> },
  ]

  const loadData = useCallback(() => {
    return Promise.all([api.settings.getTenant(), api.settings.getConfig()])
      .then(([t, c]) => {
        setTenant(t)
        const tenantValues: TenantForm = {
          name: t.name,
          nif: t.nif,
          sector: t.sector || '',
          currency: (t.currency || 'EUR') as TenantForm['currency'],
          locale: (t.locale || 'es-ES') as TenantForm['locale'],
        }
        tenantForm.reset(tenantValues)
        configForm.reset(c)
      })
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const hydrated = useHydrated()
  const { canManage } = useRole()

  if (!hydrated || loading || !tenant) return <SkeletonConfiguracion />
  if (!canManage) return <AccessDenied />

  function resetChanges() {
    tenantForm.reset()
    configForm.reset()
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      toast({ title: t('toastErrorTitle'), description: t('logoTooLarge'), variant: 'destructive' })
      return
    }
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setLogoPreview(dataUrl)
      try {
        await api.settings.updateTenant({ logo: dataUrl })
        toast({ title: t('toastDataSavedTitle'), description: t('logoSaved') })
        loadData()
      } catch (err: any) {
        toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleLogoRemove() {
    setLogoPreview(null)
    try {
      await api.settings.updateTenant({ logo: '' })
      toast({ title: t('toastDataSavedTitle'), description: t('logoRemoved') })
      loadData()
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    }
  }

  async function saveTenant(data: TenantForm) {
    setSaving(true)
    try {
      await api.settings.updateTenant({ name: data.name, nif: data.nif, sector: data.sector || null, currency: data.currency, locale: data.locale })
      toast({ title: t('toastDataSavedTitle'), description: t('toastDataSavedDesc') })
      tenantForm.reset(data)
      loadData()
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function saveConfig(data: ConfigForm) {
    setSaving(true)
    try {
      await api.settings.updateConfig(data)
      toast({ title: t('toastConfigSavedTitle'), description: t('toastConfigSavedDesc') })
      configForm.reset(data)
    } catch (err: any) {
      toast({ title: t('toastErrorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function connectBank(bankId: string) {
    setConnectingBank(bankId)
    const bank = MOCK_BANKS.find(b => b.id === bankId)
    if (!bank) return

    // Simulate OAuth redirect delay
    await new Promise(r => setTimeout(r, 2000))

    const newConn = {
      id: `conn-${Date.now()}`,
      bank: bank.name,
      iban: `ES${Math.floor(10 + Math.random() * 90)}\u2022\u2022\u2022\u2022\u2022${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'syncing' as const,
      lastSync: null,
    }
    setBankConnections(prev => [...prev, newConn])
    setShowBankConnect(false)
    setConnectingBank(null)
    setBankSearch('')

    // Simulate sync completing after delay
    setTimeout(() => {
      setBankConnections(prev => prev.map(c => c.id === newConn.id ? { ...c, status: 'connected', lastSync: new Date().toISOString() } : c))
      toast({ title: t('bankSyncComplete'), description: `${bank.name} sincronizado correctamente` })
    }, 4000)
  }

  function disconnectBank(id: string) {
    setBankConnections(prev => prev.filter(c => c.id !== id))
  }

  const configErrors = configForm.formState.errors
  const tenantErrors = tenantForm.formState.errors

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={dirty ? t('unsavedChanges') : t('subtitle')}
        lastUpdated={lastUpdated}
        onRefresh={loadData}
      />

      {/* Sticky unsaved changes bar */}
      {dirty && (
        <div className="sticky top-[60px] z-40 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-warning/30 bg-warning/10 backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span className="font-medium text-warning">{t('unsavedChanges')}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={resetChanges}>
              <RotateCcw size={12} className="mr-1" />{t('reset')}
            </Button>
            <Button size="sm" loading={saving} onClick={activeSection === 'empresa' ? tenantForm.handleSubmit(saveTenant) : configForm.handleSubmit(saveConfig)}>
              <Save size={14} className="mr-1" />{t('save')}
            </Button>
          </div>
        </div>
      )}

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
              <Button size="sm" onClick={tenantForm.handleSubmit(saveTenant)} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Logo */}
            <div className="flex items-start justify-between gap-4 py-3 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t('logoLabel')}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t('logoDesc')}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {(logoPreview || tenant?.logo) && (
                  <img
                    src={logoPreview || tenant?.logo || ''}
                    alt="Logo"
                    className="h-10 w-10 rounded-lg object-contain border border-border bg-muted"
                  />
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Upload size={12} />
                    {tenant?.logo ? t('logoChange') : t('logoUpload')}
                  </span>
                </label>
                {(logoPreview || tenant?.logo) && (
                  <button
                    onClick={handleLogoRemove}
                    className="text-xs text-destructive hover:underline"
                  >
                    {t('logoRemove')}
                  </button>
                )}
              </div>
            </div>
            <Field label={t('companyNameLabel')} desc={t('companyNameDesc')}>
              <div>
                <Input {...tenantForm.register('name')} className="h-8 text-sm" />
                <FieldError message={tenantErrors.name?.message} />
              </div>
            </Field>
            <Field label={t('nifLabel')} desc={t('nifDesc')}>
              <div>
                <Input {...tenantForm.register('nif')} className="h-8 text-sm" />
                <FieldError message={tenantErrors.nif?.message} />
              </div>
            </Field>
            <Field label={t('sectorLabel')} desc={t('sectorDesc')}>
              <div>
                <Input {...tenantForm.register('sector')} className="h-8 text-sm" placeholder={t('sectorPlaceholder')} />
                <FieldError message={tenantErrors.sector?.message} />
              </div>
            </Field>
            <Field label={t('currencyLabel')} desc={t('currencyDesc')}>
              <div>
                <Select {...tenantForm.register('currency')} className="w-full h-8 text-sm">
                  <option value="EUR">{t('currencyEur')}</option>
                  <option value="USD">{t('currencyUsd')}</option>
                  <option value="GBP">{t('currencyGbp')}</option>
                </Select>
                <FieldError message={tenantErrors.currency?.message} />
              </div>
            </Field>
            <Field label={t('languageLabel')} desc={t('languageDesc')}>
              <div>
                <Select {...tenantForm.register('locale')} className="w-full h-8 text-sm">
                  <option value="es-ES">{t('langSpanish')}</option>
                  <option value="en-US">{t('langEnglish')}</option>
                  <option value="pt-BR">{t('langPortuguese')}</option>
                </Select>
                <FieldError message={tenantErrors.locale?.message} />
              </div>
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
              <Button size="sm" onClick={configForm.handleSubmit(saveConfig)} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('dsoTargetLabel')} desc={t('dsoTargetDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={120} {...configForm.register('kpiTargets.dsoTarget', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
                </div>
                <FieldError message={configErrors.kpiTargets?.dsoTarget?.message} />
              </div>
            </Field>
            <Field label={t('dpoTargetLabel')} desc={t('dpoTargetDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={180} {...configForm.register('kpiTargets.dpoTarget', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
                </div>
                <FieldError message={configErrors.kpiTargets?.dpoTarget?.message} />
              </div>
            </Field>
            <Field label={t('cccTargetLabel')} desc={t('cccTargetDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={-30} max={120} {...configForm.register('kpiTargets.cccTarget', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
                </div>
                <FieldError message={configErrors.kpiTargets?.cccTarget?.message} />
              </div>
            </Field>
            <Field label={t('ebitdaMarginLabel')} desc={t('ebitdaMarginDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={100} step={0.1} {...configForm.register('kpiTargets.ebitdaMarginTarget', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <FieldError message={configErrors.kpiTargets?.ebitdaMarginTarget?.message} />
              </div>
            </Field>
            <Field label={t('liquidityRatioLabel')} desc={t('liquidityRatioDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0.1} max={5} step={0.05} {...configForm.register('kpiTargets.liquidezMinima', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">x</span>
                </div>
                <FieldError message={configErrors.kpiTargets?.liquidezMinima?.message} />
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
              <Button size="sm" onClick={configForm.handleSubmit(saveConfig)} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('warningThresholdLabel')} desc={t('warningThresholdDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={50} {...configForm.register('covenantAlerts.warningThreshold', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <FieldError message={configErrors.covenantAlerts?.warningThreshold?.message} />
              </div>
            </Field>
            <Field label={t('criticalThresholdLabel')} desc={t('criticalThresholdDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={50} {...configForm.register('covenantAlerts.criticalThreshold', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <FieldError message={configErrors.covenantAlerts?.criticalThreshold?.message} />
              </div>
            </Field>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
              {t('covenantExplanation', { warning: configForm.watch('covenantAlerts.warningThreshold'), critical: configForm.watch('covenantAlerts.criticalThreshold') })}
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
              <Button size="sm" onClick={configForm.handleSubmit(saveConfig)} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('forecastHorizonLabel')} desc={t('forecastHorizonDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={4} max={52} {...configForm.register('forecast.horizonWeeks', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">{t('unitWeeks')}</span>
                </div>
                <FieldError message={configErrors.forecast?.horizonWeeks?.message} />
              </div>
            </Field>
            <Field label={t('defaultScenarioLabel')} desc={t('defaultScenarioDesc')}>
              <div>
                <Select {...configForm.register('forecast.scenarioDefault')} className="w-full h-8 text-sm">
                  <option value="BASE">{t('scenarioBase')}</option>
                  <option value="CONSERVADOR">{t('scenarioConservative')}</option>
                  <option value="AGRESIVO">{t('scenarioAggressive')}</option>
                </Select>
                <FieldError message={configErrors.forecast?.scenarioDefault?.message} />
              </div>
            </Field>
            <Field label={t('gapAlertsLabel')} desc={t('gapAlertsDesc')}>
              <Switch checked={configForm.watch('forecast.gapAlertEnabled')} onChange={v => configForm.setValue('forecast.gapAlertEnabled', v, { shouldDirty: true })} />
            </Field>
            <Field label={t('customerAlertScoreLabel')} desc={t('customerAlertScoreDesc')}>
              <div>
                <Input type="number" min={0} max={100} {...configForm.register('scoring.alertScoreThreshold', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                <FieldError message={configErrors.scoring?.alertScoreThreshold?.message} />
              </div>
            </Field>
            <Field label={t('autoSuspendLabel')} desc={t('autoSuspendDesc')}>
              <Switch checked={configForm.watch('scoring.riskAutoSuspend')} onChange={v => configForm.setValue('scoring.riskAutoSuspend', v, { shouldDirty: true })} />
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
              <Button size="sm" onClick={configForm.handleSubmit(saveConfig)} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? t('saving') : t('save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('emailNotificationsLabel')} desc={t('emailNotificationsDesc')}>
              <Switch checked={configForm.watch('notifications.emailEnabled')} onChange={v => configForm.setValue('notifications.emailEnabled', v, { shouldDirty: true })} />
            </Field>
            <Field label={t('overdueAlertDaysLabel')} desc={t('overdueAlertDaysDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={90} {...configForm.register('notifications.overdueAlertDays', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
                </div>
                <FieldError message={configErrors.notifications?.overdueAlertDays?.message} />
              </div>
            </Field>
            <Field label={t('apDueSoonDaysLabel')} desc={t('apDueSoonDaysDesc')}>
              <div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={30} {...configForm.register('notifications.apDueSoonDays', { valueAsNumber: true })} className="h-8 text-sm font-mono" />
                  <span className="text-xs text-muted-foreground">{t('unitDays')}</span>
                </div>
                <FieldError message={configErrors.notifications?.apDueSoonDays?.message} />
              </div>
            </Field>
            {/* Browser push notifications */}
            <Field label="Notificaciones del navegador" desc="Recibe alertas push en el escritorio cuando no tengas la pestaña activa.">
              <div className="flex items-center gap-2">
                {pushPermission === 'granted' ? (
                  <Badge variant="default" className="text-xs">Activadas</Badge>
                ) : pushPermission === 'denied' ? (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Bloqueadas por el navegador</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={async () => {
                      const result = await requestPushPermission()
                      if (result === 'granted') {
                        toast({ title: 'Notificaciones activadas', description: 'Recibirás alertas push en el escritorio.' })
                      } else if (result === 'denied') {
                        toast({ title: 'Permiso denegado', description: 'Puedes cambiarlo en la configuración del navegador.', variant: 'destructive' })
                      }
                    }}
                  >
                    Activar
                  </Button>
                )}
              </div>
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Bancos */}
      {activeSection === 'bancos' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>{t('bankConnectionsTitle')}</CardTitle>
                <Button size="sm" onClick={() => setShowBankConnect(true)}>
                  <Plus size={14} className="mr-1" />{t('bankConnect')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connected banks */}
              {bankConnections.length > 0 ? (
                <div className="space-y-3">
                  {bankConnections.map(conn => (
                    <div key={conn.id} className="flex items-center gap-4 p-4 rounded-lg border border-border">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">{'\u{1F3E6}'}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{conn.bank}</div>
                        <div className="text-xs text-muted-foreground font-mono">{conn.iban}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {conn.status === 'syncing' ? (
                          <Badge variant="warning">{t('bankSyncing')}</Badge>
                        ) : conn.status === 'connected' ? (
                          <Badge variant="success">{t('bankConnected')}</Badge>
                        ) : (
                          <Badge variant="destructive">{t('bankError')}</Badge>
                        )}
                        {conn.lastSync && (
                          <span className="text-[10px] text-muted-foreground">{t('bankLastSync')}: {new Date(conn.lastSync).toLocaleTimeString('es-ES')}</span>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => disconnectBank(conn.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">{t('bankNoConnections')}</div>
              )}

              {/* Open Banking info */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Shield size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{t('bankSecurityTitle')}</strong> {t('bankSecurityDesc')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank search dialog */}
          {showBankConnect && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <CardTitle>{t('bankSearchTitle')}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { setShowBankConnect(false); setBankSearch('') }}>{'\u2715'}</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="text"
                  value={bankSearch}
                  onChange={e => setBankSearch(e.target.value)}
                  placeholder={t('bankSearchPlaceholder')}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  {MOCK_BANKS.filter(b => !bankSearch || b.name.toLowerCase().includes(bankSearch.toLowerCase())).map(bank => {
                    const isConnected = bankConnections.some(c => c.bank === bank.name)
                    return (
                      <button
                        key={bank.id}
                        onClick={() => !isConnected && connectBank(bank.id)}
                        disabled={isConnected || connectingBank === bank.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${isConnected ? 'opacity-50 border-border' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
                      >
                        <span className="text-xl">{bank.logo}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{bank.name}</div>
                          {isConnected && <div className="text-[10px] text-success">{t('bankAlreadyConnected')}</div>}
                        </div>
                        {connectingBank === bank.id && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Aprobaciones */}
      {activeSection === 'aprobaciones' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch size={18} />
              <CardTitle>{t('approvalTitle')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">{t('approvalDesc')}</p>
            <div className="space-y-3">
              {approvalLevels.map((level, idx) => (
                <div key={level.role} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setApprovalLevels(prev => prev.map((l, i) => i === idx ? { ...l, enabled: !l.enabled } : l))}
                      className={`w-8 h-4 rounded-full transition-colors ${level.enabled ? 'bg-success' : 'bg-muted'}`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${level.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{t(`approvalLevel_${level.role}`)}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">Nivel {idx + 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{t('approvalMinAmount')}:</span>
                    <input
                      type="number"
                      value={level.minAmount}
                      onChange={e => setApprovalLevels(prev => prev.map((l, i) => i === idx ? { ...l, minAmount: Number(e.target.value) } : l))}
                      className="bg-background border border-border rounded-md px-2 py-1 text-sm font-mono w-28"
                    />
                    <span className="text-xs text-muted-foreground">&euro;</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Visual flow */}
            <div className="flex items-center justify-center gap-2 py-3">
              {approvalLevels.filter(l => l.enabled).map((level, idx, arr) => (
                <React.Fragment key={level.role}>
                  <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                    {t(`approvalLevel_${level.role}`)}
                    <div className="text-[9px] text-muted-foreground font-normal mt-0.5">&ge; {level.minAmount.toLocaleString()} &euro;</div>
                  </div>
                  {idx < arr.length - 1 && <span className="text-muted-foreground">&rarr;</span>}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apariencia */}
      {activeSection === 'apariencia' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sun size={18} />
              <CardTitle>{t('appearanceTitle')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Field label={t('themeLabel')} desc={t('themeDesc')}>
              <div className="flex gap-1">
                {(['light', 'dark', 'system'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setTheme(opt)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      theme === opt
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt === 'light' ? t('themeLight') : opt === 'dark' ? t('themeDark') : t('themeSystem')}
                  </button>
                ))}
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
