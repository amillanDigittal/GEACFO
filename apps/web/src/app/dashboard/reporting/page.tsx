'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { SkeletonKPIsAndTable } from '@/components/ui/skeleton-page'
import { exportBoardPackPDF } from '@/lib/export-pdf'
import { Plus, Send, Pencil, Trash2, Clock, CheckCircle2, Pause, Play, FileDown, Calendar, Mail } from 'lucide-react'

const REPORT_TYPES: Record<string, { label: string; desc: string }> = {
  board_pack: { label: 'Board Pack', desc: 'Informe completo para el Consejo' },
  cockpit_summary: { label: 'Resumen Cockpit', desc: 'KPIs principales y alertas' },
  forecast_report: { label: 'Forecast 13S', desc: 'Proyección de tesorería' },
  debt_covenants: { label: 'Deuda & Covenants', desc: 'Estado de endeudamiento' },
}

const FREQUENCIES: Record<string, { label: string; desc: string }> = {
  weekly: { label: 'Semanal', desc: 'Cada lunes' },
  biweekly: { label: 'Quincenal', desc: 'Cada dos semanas' },
  monthly: { label: 'Mensual', desc: 'Primer día del mes' },
  quarterly: { label: 'Trimestral', desc: 'Inicio de cada trimestre' },
}

interface Schedule {
  id: string; name: string; reportType: string; frequency: string; recipients: string
  enabled: boolean; lastSentAt: string | null; nextRunAt: string | null; createdBy: string; createdAt: string
}

export default function ReportingPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('board_pack')
  const [formFreq, setFormFreq] = useState('monthly')
  const [formRecipients, setFormRecipients] = useState('')

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  const load = useCallback(() => {
    api.reporting.list()
      .then(d => { setSchedules(d); setLastUpdated(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <SkeletonKPIsAndTable cols={5} rows={3} />

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
      toast({ title: 'Error', description: 'Nombre y destinatarios son obligatorios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editSchedule) {
        await api.reporting.update(editSchedule.id, { name: formName, frequency: formFreq, recipients: formRecipients })
        toast({ title: 'Programación actualizada' })
      } else {
        await api.reporting.create({ name: formName, reportType: formType, frequency: formFreq, recipients: formRecipients })
        toast({ title: 'Programación creada', description: `"${formName}" programado ${FREQUENCIES[formFreq]?.label.toLowerCase()}` })
      }
      setDialogOpen(false)
      load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(s: Schedule) {
    try {
      await api.reporting.update(s.id, { enabled: !s.enabled })
      toast({ title: s.enabled ? 'Programación pausada' : 'Programación activada' })
      load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
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
      toast({ title: 'Reporte generado', description: `"${s.name}" descargado y marcado como enviado. Configurar SMTP para envío automático por email.` })
      load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSending(null)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    try {
      await api.reporting.remove(deleteConfirm.id)
      toast({ title: 'Programación eliminada' })
      setDeleteConfirm(null)
      load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setDeleteConfirm(null)
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return 'Nunca'
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function fmtRelative(d: string | null) {
    if (!d) return '—'
    const date = new Date(d)
    const now = new Date()
    const diffD = Math.ceil((date.getTime() - now.getTime()) / 86400000)
    if (diffD < 0) return 'Vencido'
    if (diffD === 0) return 'Hoy'
    if (diffD === 1) return 'Mañana'
    if (diffD < 7) return `En ${diffD} días`
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }

  const activeCount = schedules.filter(s => s.enabled).length
  const totalRecipients = new Set(schedules.flatMap(s => s.recipients.split(',').map(e => e.trim()))).size

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Reporting Automatizado"
        subtitle={`Programar envío de informes a stakeholders · ${schedules.length} programación${schedules.length !== 1 ? 'es' : ''}`}
        lastUpdated={lastUpdated}
        onRefresh={load}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1" />Nueva Programación
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Programaciones', value: schedules.length, icon: <Calendar size={14} /> },
          { label: 'Activas', value: activeCount, icon: <Play size={14} />, color: 'text-success' },
          { label: 'Destinatarios', value: totalRecipients, icon: <Mail size={14} /> },
          { label: 'Último Envío', value: schedules.filter(s => s.lastSentAt).length > 0 ? fmtRelative(schedules.filter(s => s.lastSentAt).sort((a, b) => new Date(b.lastSentAt!).getTime() - new Date(a.lastSentAt!).getTime())[0].lastSentAt) : 'Nunca', icon: <Send size={14} /> },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className="text-muted-foreground">{m.icon}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{m.label}</span>
            </div>
            <div className={`font-mono text-xl font-bold ${m.color || ''}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* SMTP notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Mail size={16} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">Envío automático por email:</strong> Requiere configuración SMTP en las variables de entorno.
          Mientras tanto, puedes usar "Enviar ahora" para generar y descargar el PDF manualmente.
        </div>
      </div>

      {/* Schedules list */}
      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send size={32} className="mx-auto text-muted-foreground mb-3" />
            <div className="text-sm text-muted-foreground mb-3">No hay programaciones de informes</div>
            <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />Crear Primera Programación</Button>
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
                        <Badge variant={s.enabled ? 'success' : 'secondary'}>{s.enabled ? 'Activa' : 'Pausada'}</Badge>
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
                          Próximo envío: <strong className="text-foreground">{s.enabled ? fmtRelative(s.nextRunAt) : 'Pausado'}</strong>
                        </span>
                        {s.lastSentAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-success" />
                            Último: {fmtDate(s.lastSentAt)}
                          </span>
                        )}
                        <span>Creado por: {s.createdBy}</span>
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
                        <Send size={12} />{sending === s.id ? 'Generando...' : 'Enviar ahora'}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editSchedule ? 'Editar Programación' : 'Nueva Programación'}</DialogTitle>
            <DialogDescription>Configura el envío automático de informes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nombre *</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Board Pack mensual Consejo" />
            </div>

            {!editSchedule && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tipo de Informe *</label>
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
              <label className="text-xs text-muted-foreground block mb-1">Frecuencia *</label>
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
              <label className="text-xs text-muted-foreground block mb-1">Destinatarios * <span className="text-[10px]">(separados por comas)</span></label>
              <Input
                value={formRecipients}
                onChange={e => setFormRecipients(e.target.value)}
                placeholder="cfo@empresa.es, consejo@empresa.es"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editSchedule ? 'Guardar Cambios' : 'Crear Programación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar Programación</DialogTitle>
            <DialogDescription>
              ¿Eliminar "{deleteConfirm?.name}"? Los destinatarios dejarán de recibir este informe.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
