'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react'

interface TourStep {
  target: string // CSS selector
  title: string
  description: string
  position: 'bottom' | 'right' | 'left' | 'top'
  route?: string // navigate here before showing
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'nav[aria-label="Navegación principal"]',
    title: 'Panel de Navegación',
    description: 'Aquí encontrarás todos los módulos de GEACFO organizados por secciones: Tesorería, Riesgo, Deuda, Inventario, Planificación y Plataforma. Puedes fijar tus páginas favoritas con la estrella ⭐.',
    position: 'right',
  },
  {
    target: 'header',
    title: 'Barra Superior',
    description: 'Migas de pan para saber dónde estás, buscador global (Cmd+K), notificaciones en tiempo real, cambio de tema claro/oscuro, y acceso rápido al Board Pack y Bot CFO.',
    position: 'bottom',
  },
  {
    target: '.page-title',
    title: 'Cockpit CFO',
    description: 'Tu panel de control principal. Muestra los 8 KPIs más importantes, evolución de caja, estado de covenants, recomendaciones de IA y tareas con impacto en caja.',
    position: 'bottom',
    route: '/dashboard/cockpit',
  },
  {
    target: '.grid.grid-cols-2.lg\\:grid-cols-4',
    title: 'KPIs Interactivos',
    description: 'Haz clic en cualquier KPI para ver su drill-down con desglose, evolución temporal y fuente de datos. Los valores se calculan en tiempo real desde la base de datos.',
    position: 'bottom',
  },
  {
    target: 'button:has(.lucide-search)',
    title: 'Búsqueda Global (⌘K)',
    description: 'Busca cualquier página, cliente, proveedor o factura al instante. Pulsa Cmd+K (Mac) o Ctrl+K (Windows) desde cualquier pantalla.',
    position: 'bottom',
  },
  {
    target: 'button[aria-label*="Notificaciones"]',
    title: 'Centro de Alertas',
    description: 'Las alertas se generan automáticamente: facturas vencidas, covenants en riesgo, gaps de forecast, y alertas predictivas que avisan con semanas de antelación.',
    position: 'bottom',
  },
]

const STORAGE_KEY = 'geacfo-onboarding-completed'

export function OnboardingTour() {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const router = useRouter()

  // Check if first visit
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      // Small delay to let the page render
      const timer = setTimeout(() => setShowWelcome(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const highlightTarget = useCallback((stepIndex: number) => {
    const s = TOUR_STEPS[stepIndex]
    if (!s) return

    // Navigate if needed
    if (s.route && window.location.pathname !== s.route) {
      router.push(s.route)
      // Wait for navigation
      setTimeout(() => {
        const el = document.querySelector(s.target)
        if (el) setTargetRect(el.getBoundingClientRect())
        else setTargetRect(null)
      }, 500)
    } else {
      setTimeout(() => {
        const el = document.querySelector(s.target)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          setTimeout(() => setTargetRect(el.getBoundingClientRect()), 100)
        } else {
          setTargetRect(null)
        }
      }, 100)
    }
  }, [router])

  function startTour() {
    setShowWelcome(false)
    setActive(true)
    setStep(0)
    highlightTarget(0)
  }

  function skipTour() {
    setShowWelcome(false)
    setActive(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  function nextStep() {
    if (step < TOUR_STEPS.length - 1) {
      const next = step + 1
      setStep(next)
      highlightTarget(next)
    } else {
      // Tour complete
      setActive(false)
      localStorage.setItem(STORAGE_KEY, 'true')
    }
  }

  function prevStep() {
    if (step > 0) {
      const prev = step - 1
      setStep(prev)
      highlightTarget(prev)
    }
  }

  // Recalculate position on resize
  useEffect(() => {
    if (!active) return
    function handleResize() { highlightTarget(step) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [active, step, highlightTarget])

  // Welcome modal
  if (showWelcome) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-[300] backdrop-blur-sm" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[301] w-[calc(100%-2rem)] max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--gold))] flex items-center justify-center">
              <Sparkles size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Bienvenido a GEACFO</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Tu plataforma CFO inteligente. Te guiamos por las secciones principales para que aproveches todo el potencial de la herramienta.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={startTour} className="w-full">
                <Sparkles size={14} className="mr-2" />
                Comenzar Tour Guiado
              </Button>
              <Button variant="ghost" onClick={skipTour} className="w-full text-muted-foreground">
                Saltar, ya conozco la plataforma
              </Button>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!active) return null

  const currentStep = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1
  const padding = 8

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {}
  if (targetRect) {
    switch (currentStep.position) {
      case 'bottom':
        tooltipStyle = { top: targetRect.bottom + padding + 8, left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 380)) }
        break
      case 'right':
        tooltipStyle = { top: Math.max(16, targetRect.top), left: targetRect.right + padding + 8 }
        break
      case 'left':
        tooltipStyle = { top: Math.max(16, targetRect.top), right: window.innerWidth - targetRect.left + padding + 8 }
        break
      case 'top':
        tooltipStyle = { bottom: window.innerHeight - targetRect.top + padding + 8, left: Math.max(16, targetRect.left) }
        break
    }
  } else {
    // Center if no target found
    tooltipStyle = { top: '30%', left: '50%', transform: 'translateX(-50%)' }
  }

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div className="fixed inset-0 z-[300] pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - padding}
                  y={targetRect.top - padding}
                  width={targetRect.width + padding * 2}
                  height={targetRect.height + padding * 2}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-mask)" />
        </svg>
      </div>

      {/* Highlight border */}
      {targetRect && (
        <div
          className="fixed z-[301] border-2 border-primary rounded-xl pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.2)',
          }}
        />
      )}

      {/* Click blocker */}
      <div className="fixed inset-0 z-[302]" onClick={e => e.stopPropagation()} />

      {/* Tooltip */}
      <div
        className="fixed z-[303] w-[340px] max-w-[calc(100vw-2rem)]"
        style={tooltipStyle}
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl p-5">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : i < step ? 'w-3 bg-primary/40' : 'w-3 bg-muted'}`}
                />
              ))}
            </div>
            <button onClick={skipTour} className="text-muted-foreground hover:text-foreground p-1 -mr-1">
              <X size={14} />
            </button>
          </div>

          <h3 className="text-sm font-bold text-foreground mb-1.5">{currentStep.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{currentStep.description}</p>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{step + 1} / {TOUR_STEPS.length}</span>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={prevStep}>
                  <ChevronLeft size={12} className="mr-0.5" />Anterior
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs" onClick={nextStep}>
                {isLast ? 'Finalizar' : 'Siguiente'}
                {!isLast && <ChevronRight size={12} className="ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
