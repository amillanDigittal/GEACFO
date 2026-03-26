'use client'

import { useEffect, useState, useCallback } from 'react'

const COLORS = [
  'hsl(var(--success))',
  'hsl(var(--primary))',
  'hsl(var(--gold))',
  'hsl(160, 64%, 52%)',
  'hsl(211, 100%, 64%)',
  'hsl(40, 80%, 58%)',
]
const PARTICLE_COUNT = 28
const DURATION = 1200

interface Particle {
  id: number
  x: number
  color: string
  delay: number
  size: number
  angle: number
  distance: number
  shape: 'circle' | 'rect'
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 200,
    size: 4 + Math.random() * 5,
    angle: (i / PARTICLE_COUNT) * 360 + (Math.random() - 0.5) * 30,
    distance: 60 + Math.random() * 80,
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
  }))
}

/**
 * Renders a burst of confetti particles.
 * Usage: <Confetti trigger={someBoolean} />
 * When trigger goes from false→true, a 1-second confetti burst plays.
 */
export function Confetti({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<Particle[] | null>(null)
  const [prevTrigger, setPrevTrigger] = useState(false)

  useEffect(() => {
    // Detect rising edge: false → true
    if (trigger && !prevTrigger) {
      setParticles(generateParticles())
      const timer = setTimeout(() => setParticles(null), DURATION + 300)
      return () => clearTimeout(timer)
    }
    setPrevTrigger(trigger)
  }, [trigger, prevTrigger])

  if (!particles) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden="true">
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180
        const tx = Math.cos(rad) * p.distance
        const ty = Math.sin(rad) * p.distance - 40 // bias upward
        return (
          <div
            key={p.id}
            className="confetti-particle"
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: '50%',
              width: p.size,
              height: p.shape === 'rect' ? p.size * 0.6 : p.size,
              borderRadius: p.shape === 'circle' ? '50%' : '1.5px',
              backgroundColor: p.color,
              '--tx': `${tx}px`,
              '--ty': `${ty}px`,
              '--rot': `${Math.random() * 720 - 360}deg`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${DURATION}ms`,
            } as React.CSSProperties}
          />
        )
      })}
    </div>
  )
}

/**
 * Hook: returns a trigger boolean and a fire function.
 * Call fire() to trigger confetti. Auto-resets after the animation.
 */
export function useConfetti() {
  const [active, setActive] = useState(false)
  const fire = useCallback(() => {
    setActive(false)
    // Force re-trigger on next tick
    requestAnimationFrame(() => setActive(true))
    setTimeout(() => setActive(false), DURATION + 500)
  }, [])
  return { active, fire }
}
