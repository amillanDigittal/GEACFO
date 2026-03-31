'use client'
import { useState, useEffect } from 'react'
import { BarChart3, X as XIcon, ArrowUp, ArrowDown } from 'lucide-react'

export default function PresentationOverlay({
  kpis, data, compareMode, computeDelta, slideIdx, setSlideIdx, onClose,
}: {
  kpis: any[]; data: any; compareMode: any; computeDelta: any
  slideIdx: number; setSlideIdx: (v: number | ((p: number) => number)) => void; onClose: () => void
}) {
  const [progress, setProgress] = useState(0)
  const INTERVAL = 10000

  // Auto-rotate slides
  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      setProgress(Math.min((elapsed % INTERVAL) / INTERVAL * 100, 100))
    }
    const raf = setInterval(tick, 50)
    const rotate = setInterval(() => {
      setSlideIdx((prev: number) => (prev + 1) % kpis.length)
    }, INTERVAL)
    return () => { clearInterval(raf); clearInterval(rotate) }
  }, [slideIdx, kpis.length, setSlideIdx])

  // Keyboard: Escape to close, arrows to navigate
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setSlideIdx((slideIdx + 1) % kpis.length) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setSlideIdx((slideIdx - 1 + kpis.length) % kpis.length) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slideIdx, kpis.length, setSlideIdx, onClose])

  // Listen for fullscreen exit
  useEffect(() => {
    function onFsChange() { if (!document.fullscreenElement) onClose() }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [onClose])

  const k = kpis[slideIdx]
  if (!k) return null
  const raw = data[k.key as keyof typeof data] as any
  const currentVal = raw?.value ?? 0
  const delta = computeDelta(k.key, currentVal, compareMode)

  return (
    <div className="fixed inset-0 z-[999] bg-background flex flex-col items-center justify-center presentation-enter">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-[hsl(var(--gold))] rounded-lg flex items-center justify-center">
            <BarChart3 size={16} className="text-white" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">GEACFO</span>
          <span className="text-xs text-muted-foreground font-mono ml-2">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <XIcon size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted/30">
        <div className="h-full bg-primary transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
      </div>

      {/* Main slide */}
      <div key={slideIdx} className="flex flex-col items-center gap-6 presentation-slide">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <span className="scale-[2]">{k.icon}</span>
        </div>
        <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-semibold">{k.label}</div>
        <div className="font-mono text-7xl md:text-8xl font-bold text-foreground tracking-tight">{k.value}</div>
        {k.trend && (
          <div className={`flex items-center gap-2 text-2xl font-semibold ${k.up ? 'text-success' : 'text-destructive'}`}>
            {k.up ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
            <span>{k.trend}</span>
          </div>
        )}
        {delta && (
          <div className={`text-lg font-mono ${delta.positive ? 'text-success' : 'text-destructive'}`}>{delta.text}</div>
        )}
        {k.sub && <div className="text-sm text-muted-foreground">{k.sub}</div>}
      </div>

      {/* Bottom dots */}
      <div className="absolute bottom-8 flex items-center gap-2">
        {kpis.map((_: any, i: number) => (
          <button
            key={i}
            onClick={() => setSlideIdx(i)}
            className={`rounded-full transition-all ${i === slideIdx ? 'w-8 h-2 bg-primary' : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'}`}
          />
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 text-[10px] text-muted-foreground/50">
        ← → para navegar · Esc para salir · Auto-rota cada 10s
      </div>
    </div>
  )
}
