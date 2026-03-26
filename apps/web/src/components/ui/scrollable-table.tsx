'use client'
import { useRef, useState, useEffect, useCallback, memo, type ReactNode } from 'react'

interface ScrollableTableProps {
  children: React.ReactNode
  /** Accessible label describing the table contents (e.g. "Detalle de Facturas") */
  label?: string
  /** Max height in px — enables vertical scroll with sticky thead */
  maxHeight?: number
}

export function ScrollableTable({ children, label, maxHeight }: ScrollableTableProps) {
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
      <div ref={ref} className="overflow-x-auto scrollbar-table" role="region" aria-label={label} tabIndex={label ? 0 : undefined} style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        {children}
      </div>
    </div>
  )
}

// ── Accessible <th> ─────────────────────────────────────────────────
interface ThProps {
  children: ReactNode
  /** Sortable column — provide current sort state and handler */
  sorted?: 'asc' | 'desc' | false
  onSort?: () => void
  className?: string
}

const TH_BASE = 'text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider'

/**
 * Accessible table header cell.
 * - Always renders `scope="col"`
 * - When `sorted` is provided, adds `aria-sort` and renders a keyboard-accessible button
 */
export const Th = memo(function Th({ children, sorted, onSort, className }: ThProps) {
  if (onSort) {
    const ariaSort = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
    return (
      <th scope="col" aria-sort={ariaSort} className={`${TH_BASE} ${className || ''}`}>
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
        >
          {children}
          {sorted === 'asc' && <span aria-hidden="true"> ↑</span>}
          {sorted === 'desc' && <span aria-hidden="true"> ↓</span>}
        </button>
      </th>
    )
  }

  return (
    <th scope="col" className={`${TH_BASE} ${className || ''}`}>
      {children}
    </th>
  )
})
