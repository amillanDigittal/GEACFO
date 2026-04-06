'use client'
import { useEffect, useState, useCallback } from 'react'
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
import { Building2, Target, Bell, TrendingUp, Shield, Save, RotateCcw, Sparkles, Sun, Upload } from 'lucide-react'
import { useTheme } from 'next-themes'
import { PageHeader } from '@/components/page-header'
import { useRole } from '@/hooks/use-role'
import { AccessDenied } from '@/components/ui/access-denied'

interface Tenant {
  id: string; name: string; nif: string; sector: string | null; slug: string; logo: string | null; currency: string; locale: string
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
