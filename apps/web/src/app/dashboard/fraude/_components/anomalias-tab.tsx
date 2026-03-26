'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/ui/empty-state'
import { Anomaly, severityConfig } from './types'

interface AnomaliasTabProps {
  anomalies: Anomaly[]
  invoicesAP: any[]
  anomPage: number
  setAnomPage: React.Dispatch<React.SetStateAction<number>>
  anomAction: string | null
  setAnomAction: React.Dispatch<React.SetStateAction<string | null>>
  anomActing: boolean
  setAnomActing: React.Dispatch<React.SetStateAction<boolean>>
  dismissedAnoms: Set<string>
  setDismissedAnoms: React.Dispatch<React.SetStateAction<Set<string>>>
  fetchData: () => Promise<void>
  fmtDate: (d: string) => string
  fmtEur: (n: number) => string
  toast: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' | 'success' }) => void
}

export function AnomaliasTab({
  anomalies,
  invoicesAP,
  anomPage,
  setAnomPage,
  anomAction,
  setAnomAction,
  anomActing,
  setAnomActing,
  dismissedAnoms,
  setDismissedAnoms,
  fetchData,
  fmtDate,
  fmtEur,
  toast,
}: AnomaliasTabProps) {
  async function handleRejectDuplicate(anom: Anomaly) {
    if (!anom.invoiceIds || anom.invoiceIds.length < 2) return
    setAnomActing(true)
    try {
      // Reject the second invoice (the suspected duplicate)
      await api.treasury.rejectAP(anom.invoiceIds[1], 'Duplicado confirmado desde Fraude & Compliance')
      toast({ title: 'Duplicado confirmado', description: `Factura rechazada. La primera factura se mantiene activa.` })
      setAnomAction(null)
      await fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setAnomActing(false) }
  }

  async function handleApproveFromAnomaly(anom: Anomaly) {
    if (!anom.invoiceIds?.length) return
    setAnomActing(true)
    try {
      for (const id of anom.invoiceIds) {
        await api.treasury.approveAP(id)
      }
      toast({ title: 'Factura(s) aprobada(s)', description: 'Las facturas han sido aprobadas correctamente.' })
      setAnomAction(null)
      await fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setAnomActing(false) }
  }

  function handleDismiss(anomId: string) {
    setDismissedAnoms(prev => new Set(prev).add(anomId))
    setAnomAction(null)
    toast({ title: 'Descartada', description: 'Anomalía marcada como falso positivo.' })
  }

  const visibleAnomalies = anomalies.filter(a => !dismissedAnoms.has(a.id))

  if (visibleAnomalies.length === 0) {
    return (
      <EmptyState
        variant="search"
        title="No se han detectado anomalías"
        description="Se analizan duplicados, pagos sin aprobación e impagos prolongados"
      />
    )
  }

  return (
    <div className="space-y-2">
      {visibleAnomalies.slice(anomPage * 10, (anomPage + 1) * 10).map(a => {
        const sev = severityConfig[a.severity] || severityConfig.LOW
        const isExpanded = anomAction === a.id
        const isDuplicate = a.type === 'Posible duplicado'
        const isLargeAP = a.type === 'Pago grande sin aprobación'
        return (
          <div key={a.id} className={`p-4 rounded-lg border transition-colors ${a.severity === 'HIGH' ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={sev.variant}>{sev.label}</Badge>
                  <Badge variant={isDuplicate ? 'destructive' : 'secondary'}>{a.type}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{a.invoiceNumber}</span>
                </div>
                <div className="text-sm font-medium">{a.entity}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span>Importe: <span className="font-mono font-semibold text-foreground">{fmtEur(a.amount)}</span></span>
                  <span>Detectada: {fmtDate(a.detectedAt)}</span>
                </div>
              </div>
              {a.actionable && (
                <div className="flex-shrink-0">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAnomAction(isExpanded ? null : a.id)}>
                    {isExpanded ? 'Cerrar' : 'Acciones'}
                  </Button>
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-border">
                {isDuplicate && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Se han detectado 2 facturas del mismo proveedor con el mismo importe emitidas en menos de 7 días.
                      Selecciona la acción a tomar:
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRejectDuplicate(a)} disabled={anomActing}>
                        <ShieldX size={12} className="mr-1" />
                        {anomActing ? 'Procesando…' : 'Confirmar Duplicado (rechazar 2ª factura)'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDismiss(a.id)}>
                        <CheckCircle2 size={12} className="mr-1" />No es duplicado (descartar)
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {a.invoiceIds?.map((id, idx) => {
                        const inv = invoicesAP.find((i: any) => i.id === id)
                        return inv ? (
                          <div key={id} className={`p-2 rounded border ${idx === 1 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'}`}>
                            <div className="font-semibold">{idx === 0 ? 'Factura Original' : 'Posible Duplicado'}</div>
                            <div className="text-muted-foreground mt-1">
                              <div>Nº: <span className="font-mono">{inv.number}</span></div>
                              <div>Fecha: {fmtDate(inv.issueDate)}</div>
                              <div>Importe: <span className="font-mono">{fmtEur(Number(inv.totalAmount))}</span></div>
                              <div>Estado: <span className="font-semibold">{inv.status}</span></div>
                            </div>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
                {isLargeAP && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Factura de importe alto sin aprobación registrada.</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleApproveFromAnomaly(a)} disabled={anomActing}>
                        <ShieldCheck size={12} className="mr-1" />
                        {anomActing ? 'Procesando…' : 'Aprobar Factura'}
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { if (a.invoiceIds?.[0]) { api.treasury.rejectAP(a.invoiceIds[0], 'Rechazada desde Fraude & Compliance').then(() => { toast({ title: 'Factura rechazada' }); fetchData() }) } }} disabled={anomActing}>
                        <ShieldX size={12} className="mr-1" />Rechazar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDismiss(a.id)}>
                        Descartar
                      </Button>
                    </div>
                  </div>
                )}
                {!isDuplicate && !isLargeAP && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDismiss(a.id)}>
                      <CheckCircle2 size={12} className="mr-1" />Descartar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      {visibleAnomalies.length > 10 && (
        <div className="flex items-center justify-center gap-2 p-3">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={anomPage === 0} onClick={() => setAnomPage(p => p - 1)}>&#8592;</Button>
          {Array.from({ length: Math.ceil(visibleAnomalies.length / 10) }, (_, i) => (
            <button key={i} onClick={() => setAnomPage(i)} className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${anomPage === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{i + 1}</button>
          ))}
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={anomPage >= Math.ceil(visibleAnomalies.length / 10) - 1} onClick={() => setAnomPage(p => p + 1)}>&#8594;</Button>
          <span className="text-xs text-muted-foreground ml-2">{anomPage * 10 + 1}–{Math.min((anomPage + 1) * 10, visibleAnomalies.length)} de {visibleAnomalies.length}</span>
        </div>
      )}
    </div>
  )
}
