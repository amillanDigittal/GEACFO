'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Parse a formatted number string into its parts.
 * Handles Spanish (1.245.000), decimal comma (4,82), English decimal (1.85), plain (42).
 */
function parse(value: string) {
  const m = value.match(/^(.*?)(\d[\d.,]*\d|\d)(.*)$/)
  if (!m) return null

  const [, prefix, raw, suffix] = m
  const dots = (raw.match(/\./g) || []).length
  const commas = (raw.match(/,/g) || []).length
  const lastDot = raw.lastIndexOf('.')
  const lastComma = raw.lastIndexOf(',')

  let num: number
  let decimals: number
  let locale: 'es' | 'en'

  if (commas === 1 && lastComma > lastDot) {
    // Spanish decimal: "4,82" or "1.245,30"
    num = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    decimals = raw.length - lastComma - 1
    locale = 'es'
  } else if (dots >= 2) {
    // Multiple dots = thousand separators: "1.245.000"
    num = parseFloat(raw.replace(/\./g, ''))
    decimals = 0
    locale = 'es'
  } else if (dots === 1 && commas === 0) {
    const afterDot = raw.split('.')[1]
    if (afterDot.length >= 3 && !afterDot.includes(',')) {
      // Likely thousand sep: "1.245"
      num = parseFloat(raw.replace('.', ''))
      decimals = 0
      locale = 'es'
    } else {
      // English decimal: "1.85", "3.2"
      num = parseFloat(raw)
      decimals = afterDot.length
      locale = 'en'
    }
  } else {
    // Plain integer: "42"
    num = parseInt(raw, 10)
    decimals = 0
    locale = 'es'
  }

  if (isNaN(num)) return null

  const fmt = (n: number): string => {
    if (locale === 'en') return n.toFixed(decimals)
    return n.toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  return { prefix, num, suffix, fmt }
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

interface AnimatedValueProps {
  /** The fully formatted display string, e.g. "1.245.000 €" */
  value: string
  /** Animation duration in ms */
  duration?: number
  /** Delay before animation starts (syncs with card stagger) */
  delay?: number
}

export function AnimatedValue({ value, duration = 800, delay = 0 }: AnimatedValueProps) {
  const [display, setDisplay] = useState(value)
  const prevValue = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    // On value change, reset
    const parsed = parse(value)
    if (!parsed) {
      setDisplay(value)
      return
    }

    // Respect reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }

    const { prefix, num: target, suffix, fmt } = parsed

    // Animate from 0 on first mount, or from previous number on updates
    let from = 0
    if (prevValue.current !== value) {
      const prevParsed = parse(prevValue.current)
      if (prevParsed) from = prevParsed.num
    }
    prevValue.current = value

    const startTime = performance.now() + delay

    function tick(now: number) {
      const elapsed = now - startTime
      if (elapsed < 0) {
        setDisplay(`${prefix}${fmt(from)}${suffix}`)
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(elapsed / duration, 1)
      const current = from + (target - from) * easeOutCubic(t)
      setDisplay(`${prefix}${fmt(current)}${suffix}`)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration, delay])

  return <>{display}</>
}
