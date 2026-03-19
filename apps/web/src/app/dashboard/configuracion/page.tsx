'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { Building2, Target, Bell, TrendingUp, Shield, Save, RotateCcw } from 'lucide-react'
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

const SECTIONS = [
  { key: 'empresa', label: 'Empresa', icon: <Building2 size={14} /> },
  { key: 'kpis', label: 'Umbrales KPIs', icon: <Target size={14} /> },
  { key: 'covenants', label: 'Covenants', icon: <Shield size={14} /> },
  { key: 'forecast', label: 'Forecast', icon: <TrendingUp size={14} /> },
  { key: 'notificaciones', label: 'Notificaciones', icon: <Bell size={14} /> },
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
      })
      .catch(console.error)
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading || !config) return <SkeletonKPIsAndTable cols={2} rows={6} />

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
      toast({ title: 'Datos guardados', description: 'Información de la empresa actualizada' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function saveConfig() {
    setSaving(true)
    try {
      await api.settings.updateConfig(config)
      toast({ title: 'Configuración guardada', description: 'Umbrales y preferencias actualizados' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Configuración"
        subtitle="Datos de empresa, umbrales de KPIs y preferencias del sistema"
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
                <CardTitle>Datos de la Empresa</CardTitle>
              </div>
              <Button size="sm" onClick={saveTenant} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label="Nombre de la empresa" desc="Razón social completa">
              <Input value={tName} onChange={e => setTName(e.target.value)} className="h-8 text-sm" />
            </Field>
            <Field label="NIF / CIF" desc="Identificación fiscal">
              <Input value={tNif} onChange={e => setTNif(e.target.value)} className="h-8 text-sm" />
            </Field>
            <Field label="Sector" desc="Industria o actividad principal">
              <Input value={tSector} onChange={e => setTSector(e.target.value)} className="h-8 text-sm" placeholder="Ej: Industria & Distribución" />
            </Field>
            <Field label="Moneda" desc="Moneda principal de operación">
              <select value={tCurrency} onChange={e => setTCurrency(e.target.value)} className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm">
                <option value="EUR">EUR — Euro</option>
                <option value="USD">USD — Dólar</option>
                <option value="GBP">GBP — Libra</option>
              </select>
            </Field>
            <Field label="Idioma" desc="Idioma de la interfaz y formatos">
              <select value={tLocale} onChange={e => setTLocale(e.target.value)} className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm">
                <option value="es-ES">Español (España)</option>
                <option value="en-US">English (US)</option>
                <option value="pt-BR">Português (Brasil)</option>
              </select>
            </Field>
            <Field label="Slug" desc="Identificador único (no editable)">
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
                <CardTitle>Umbrales de KPIs</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label="DSO Objetivo" desc="Days Sales Outstanding — plazo objetivo de cobro en días">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={120} value={config.kpiTargets.dsoTarget} onChange={e => updateConfig('kpiTargets.dsoTarget', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">días</span>
              </div>
            </Field>
            <Field label="DPO Objetivo" desc="Days Payable Outstanding — plazo objetivo de pago en días">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={180} value={config.kpiTargets.dpoTarget} onChange={e => updateConfig('kpiTargets.dpoTarget', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">días</span>
              </div>
            </Field>
            <Field label="CCC Objetivo" desc="Cash Conversion Cycle — ciclo de conversión de efectivo máximo">
              <div className="flex items-center gap-2">
                <Input type="number" min={-30} max={120} value={config.kpiTargets.cccTarget} onChange={e => updateConfig('kpiTargets.cccTarget', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">días</span>
              </div>
            </Field>
            <Field label="Margen EBITDA Mínimo" desc="Objetivo de margen operativo mínimo">
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={100} step={0.1} value={config.kpiTargets.ebitdaMarginTarget} onChange={e => updateConfig('kpiTargets.ebitdaMarginTarget', parseFloat(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="Ratio de Liquidez Mínimo" desc="Ratio mínimo de activo corriente / pasivo corriente">
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
                <CardTitle>Alertas de Covenants</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label="Umbral de Advertencia" desc="Se muestra alerta amarilla cuando el margen es inferior a este %">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={50} value={config.covenantAlerts.warningThreshold} onChange={e => updateConfig('covenantAlerts.warningThreshold', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="Umbral Crítico" desc="Se muestra alerta roja cuando el margen es inferior a este %">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={50} value={config.covenantAlerts.criticalThreshold} onChange={e => updateConfig('covenantAlerts.criticalThreshold', parseInt(e.target.value) || 0)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
              Con estos umbrales: margen &lt; {config.covenantAlerts.warningThreshold}% = advertencia, margen &lt; {config.covenantAlerts.criticalThreshold}% = crítico.
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
                <CardTitle>Configuración de Forecast</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label="Horizonte de Forecast" desc="Número de semanas del forecast rolling">
              <div className="flex items-center gap-2">
                <Input type="number" min={4} max={52} value={config.forecast.horizonWeeks} onChange={e => updateConfig('forecast.horizonWeeks', parseInt(e.target.value) || 13)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">semanas</span>
              </div>
            </Field>
            <Field label="Escenario por Defecto" desc="Escenario que se muestra al entrar en forecast">
              <select value={config.forecast.scenarioDefault} onChange={e => updateConfig('forecast.scenarioDefault', e.target.value)} className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm">
                <option value="BASE">Base</option>
                <option value="CONSERVADOR">Conservador</option>
                <option value="AGRESIVO">Agresivo</option>
              </select>
            </Field>
            <Field label="Alertas de Gap" desc="Generar alertas automáticas cuando se detectan gaps de caja">
              <Toggle checked={config.forecast.gapAlertEnabled} onChange={v => updateConfig('forecast.gapAlertEnabled', v)} />
            </Field>
            <Field label="Score Alerta Clientes" desc="Score por debajo del cual se marca el cliente en alerta">
              <Input type="number" min={0} max={100} value={config.scoring.alertScoreThreshold} onChange={e => updateConfig('scoring.alertScoreThreshold', parseInt(e.target.value) || 50)} className="h-8 text-sm font-mono" />
            </Field>
            <Field label="Auto-suspender clientes de riesgo" desc="Suspender automáticamente clientes con score muy bajo">
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
                <CardTitle>Preferencias de Notificaciones</CardTitle>
              </div>
              <Button size="sm" onClick={saveConfig} disabled={saving}>
                <Save size={14} className="mr-1" />{saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Field label="Notificaciones por Email" desc="Enviar alertas críticas por email (requiere configuración SMTP)">
              <Toggle checked={config.notifications.emailEnabled} onChange={v => updateConfig('notifications.emailEnabled', v)} />
            </Field>
            <Field label="Días Alerta Vencimiento AR" desc="Alertar cuando una factura de cobro está vencida más de X días">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={90} value={config.notifications.overdueAlertDays} onChange={e => updateConfig('notifications.overdueAlertDays', parseInt(e.target.value) || 3)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">días</span>
              </div>
            </Field>
            <Field label="Días Aviso Pago AP" desc="Alertar cuando un pago vence en los próximos X días">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={30} value={config.notifications.apDueSoonDays} onChange={e => updateConfig('notifications.apDueSoonDays', parseInt(e.target.value) || 3)} className="h-8 text-sm font-mono" />
                <span className="text-xs text-muted-foreground">días</span>
              </div>
            </Field>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
