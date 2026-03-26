'use client'

import { memo, useEffect, useState } from 'react'

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

export function AnimatedValue({ value, delay = 0 }: AnimatedValueProps) {
  return (
    <span className="inline-flex" aria-label={value}>
      {value.split('').map((char, i) => (
        <FlipDigit key={`${i}-${char}`} char={char} stagger={delay + i * 25} />
      ))}
    </span>
  )
}
