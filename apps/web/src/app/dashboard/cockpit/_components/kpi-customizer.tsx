'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app'
import { Button } from '@/components/ui/button'
import { Settings2, GripVertical, Eye, EyeOff, RotateCcw, X } from 'lucide-react'

interface KpiDef {
  key: string
  label: string
  icon: React.ReactNode
}

interface KpiCustomizerProps {
  kpis: KpiDef[]
}

export function KpiCustomizer({ kpis }: KpiCustomizerProps) {
  const [open, setOpen] = useState(false)
  const { cockpitLayout, setCockpitOrder, toggleCockpitKpi, resetCockpitLayout } = useAppStore()

  const order = cockpitLayout.order || kpis.map(k => k.key)
  const hidden = new Set(cockpitLayout.hidden)

  // Ordered list for display
  const ordered = order
    .map(key => kpis.find(k => k.key === key))
    .filter(Boolean) as KpiDef[]
  // Add any new KPIs not yet in the order
  kpis.forEach(k => { if (!order.includes(k.key)) ordered.push(k) })

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...order]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setCockpitOrder(next)
  }

  function moveDown(idx: number) {
    if (idx >= order.length - 1) return
    const next = [...order]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setCockpitOrder(next)
  }

  const hasChanges = cockpitLayout.order !== null || cockpitLayout.hidden.length > 0

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="text-xs"
        title="Personalizar KPIs"
      >
        <Settings2 size={14} className="mr-1" />
        Personalizar
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-72 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <span className="text-xs font-semibold">Personalizar KPIs</span>
              <div className="flex items-center gap-1">
                {hasChanges && (
                  <button
                    onClick={() => { resetCockpitLayout() }}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                    title="Restaurar orden por defecto"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5" aria-label="Cerrar personalización">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto py-1">
              {ordered.map((kpi, idx) => {
                const isHidden = hidden.has(kpi.key)
                return (
                  <div
                    key={kpi.key}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${isHidden ? 'opacity-40' : ''}`}
                  >
                    {/* Drag handle area with up/down buttons */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        aria-label={`Mover ${kpi.label} arriba`}
                      >
                        <GripVertical size={10} className="rotate-90" />
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx >= ordered.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        aria-label={`Mover ${kpi.label} abajo`}
                      >
                        <GripVertical size={10} className="-rotate-90" />
                      </button>
                    </div>

                    {/* KPI info */}
                    <span className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-muted-foreground flex-shrink-0">{kpi.icon}</span>
                      <span className={`truncate font-medium ${isHidden ? 'line-through' : ''}`}>{kpi.label}</span>
                    </span>

                    {/* Toggle visibility */}
                    <button
                      onClick={() => toggleCockpitKpi(kpi.key)}
                      className={`flex-shrink-0 p-1 rounded transition-colors ${isHidden ? 'text-muted-foreground hover:text-foreground' : 'text-foreground hover:text-muted-foreground'}`}
                      aria-label={isHidden ? `Mostrar ${kpi.label}` : `Ocultar ${kpi.label}`}
                    >
                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
              Usa las flechas para reordenar · Ojo para mostrar/ocultar
            </div>
          </div>
        </>
      )}
    </div>
  )
}
