'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

export function ScrollableTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [checkScroll])

  return (
    <div className="relative">
      {/* Left fade */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 transition-opacity duration-200"
        style={{
          opacity: canScrollLeft ? 1 : 0,
          background: 'linear-gradient(to right, hsl(var(--card)), transparent)',
        }}
      />
      {/* Right fade + hint */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 transition-opacity duration-200"
        style={{
          opacity: canScrollRight ? 1 : 0,
          background: 'linear-gradient(to left, hsl(var(--card)), transparent)',
        }}
      />
      {/* Scroll hint badge */}
      {canScrollRight && (
        <div className="absolute right-2 top-2 z-20 pointer-events-none md:hidden">
          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium animate-pulse">
            Desliza →
          </span>
        </div>
      )}
      <div ref={ref} className="overflow-x-auto scrollbar-table">
        {children}
      </div>
    </div>
  )
}
