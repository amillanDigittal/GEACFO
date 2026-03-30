'use client'

import { memo, useEffect, useState, useRef } from 'react'

interface AnimatedValueProps {
  /** The fully formatted display string, e.g. "1.245.000 €" */
  value: string
  /** Delay before animation starts (syncs with card stagger) */
  delay?: number
}

/** Single character that flips in on mount */
const FlipDigit = memo(function FlipDigit({ char, stagger }: { char: string; stagger: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const t = setTimeout(() => setVisible(true), stagger)
    return () => clearTimeout(t)
  }, [stagger])

  const isDigit = /[\d]/.test(char)

  if (!isDigit || visible) {
    return (
      <span
        className={isDigit && visible ? 'flip-digit-enter' : undefined}
        style={isDigit ? { display: 'inline-block', animationDelay: `${stagger}ms` } : undefined}
      >
        {char}
      </span>
    )
  }

  // Before visible: show placeholder to avoid layout shift
  return <span className="invisible">{char}</span>
})

/**
 * CountUp — animates a numeric value from 0 to its target.
 * Falls back to FlipDigit for non-numeric strings.
 */
function useCountUp(target: number, duration: number, delay: number) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    const timeout = setTimeout(() => {
      const start = performance.now()
      function tick(now: number) {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(target * eased))
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, delay])

  return value
}

export const CountUpValue = memo(function CountUpValue({ value, delay = 0, duration = 800 }: {
  value: number
  delay?: number
  duration?: number
  format?: (n: number) => string
}) {
  const animated = useCountUp(value, duration, delay)
  return <>{animated.toLocaleString('es-ES')}</>
})

export function AnimatedValue({ value, delay = 0 }: AnimatedValueProps) {
  return (
    <span className="inline-flex" aria-label={value}>
      {value.split('').map((char, i) => (
        <FlipDigit key={`${i}-${char}`} char={char} stagger={delay + i * 25} />
      ))}
    </span>
  )
}
