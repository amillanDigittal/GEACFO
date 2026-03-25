'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'

interface LazyChartProps {
  children: ReactNode
  /** Height of the placeholder before the chart loads */
  height: number
  /** Root margin for IntersectionObserver — how early to start rendering */
  rootMargin?: string
  /** Optional className for the wrapper */
  className?: string
}

/**
 * Defers rendering of heavy chart components (Recharts SVG) until
 * they scroll into (or near) the viewport. Shows a minimal skeleton
 * placeholder until then.
 *
 * Usage: wrap any <ResponsiveContainer> block with <LazyChart height={240}>
 */
export function LazyChart({ children, height, rootMargin = '200px', className }: LazyChartProps) {
  const ref = useRef<HTMLDivElement>(null!)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} className={className}>
      {visible ? (
        children
      ) : (
        <div
          className="flex items-center justify-center bg-muted/30 rounded-lg animate-pulse"
          style={{ height }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/30">
            <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 16l4-6 4 4 5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}
