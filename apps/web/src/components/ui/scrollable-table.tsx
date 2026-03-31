'use client'
import { useRef, useState, useEffect, useCallback, memo, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

interface ScrollableTableProps {
  children: React.ReactNode
  /** Accessible label describing the table contents (e.g. "Detalle de Facturas") */
  label?: string
  /** Max height in px — enables vertical scroll with sticky thead */
  maxHeight?: number
}

export function ScrollableTable({ children, label, maxHeight }: ScrollableTableProps) {
  const ref = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [thumbStyle, setThumbStyle] = useState({ width: 0, left: 0 })
  const [needsScroll, setNeedsScroll] = useState(false)
  const dragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartScroll = useRef(0)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth
    setNeedsScroll(overflow)
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
    if (overflow) {
      const ratio = el.clientWidth / el.scrollWidth
      const thumbW = Math.max(ratio * el.clientWidth, 40)
      const maxLeft = el.clientWidth - thumbW
      const scrollRatio = el.scrollLeft / (el.scrollWidth - el.clientWidth)
      setThumbStyle({ width: thumbW, left: scrollRatio * maxLeft })
    }
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

  // Drag-to-scroll on custom thumb
  const onThumbDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    dragStartX.current = e.clientX
    dragStartScroll.current = ref.current?.scrollLeft ?? 0

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !ref.current || !trackRef.current) return
      const trackW = trackRef.current.clientWidth
      const ratio = ref.current.scrollWidth / trackW
      const dx = ev.clientX - dragStartX.current
      ref.current.scrollLeft = dragStartScroll.current + dx * ratio
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // Click on track to jump
  const onTrackClick = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    const track = trackRef.current
    if (!el || !track) return
    const rect = track.getBoundingClientRect()
    const clickRatio = (e.clientX - rect.left) / rect.width
    el.scrollLeft = clickRatio * (el.scrollWidth - el.clientWidth)
  }, [])

  return (
    <div className="relative">
      {/* Left shadow indicator */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 transition-opacity duration-300 bg-gradient-to-r from-background/80 to-transparent"
        style={{ opacity: canScrollLeft ? 1 : 0 }}
      >
        <div className="absolute inset-0 shadow-[inset_8px_0_8px_-4px_rgba(0,0,0,0.15)]" />
      </div>
      {/* Right shadow indicator + arrow */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 transition-opacity duration-300 bg-gradient-to-l from-background/80 to-transparent"
        style={{ opacity: canScrollRight ? 1 : 0 }}
      >
        <div className="absolute inset-0 shadow-[inset_-8px_0_8px_-4px_rgba(0,0,0,0.15)]" />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-xs select-none" aria-hidden="true">
          &#8250;
        </span>
      </div>
      {/* Scroll hint badge */}
      {canScrollRight && (
        <div className="absolute right-2 top-2 z-20 pointer-events-none md:hidden">
          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium animate-pulse">
            Desliza →
          </span>
        </div>
      )}
      <div
        ref={ref}
        className="scrollbar-table"
        role="region"
        aria-label={label}
        tabIndex={label ? 0 : undefined}
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        {children}
      </div>
      {/* Custom always-visible scrollbar */}
      {needsScroll && (
        <div
          ref={trackRef}
          className="custom-scrollbar-track"
          onClick={onTrackClick}
        >
          <div
            className="custom-scrollbar-thumb"
            style={{ width: thumbStyle.width, left: thumbStyle.left }}
            onMouseDown={onThumbDown}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
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
  /** When provided, renders a small help icon with a native tooltip explaining the column */
  tooltip?: string
}

const TH_BASE = 'text-left p-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider'

/**
 * Accessible table header cell.
 * - Always renders `scope="col"`
 * - When `sorted` is provided, adds `aria-sort` and renders a keyboard-accessible button
 */
export const Th = memo(function Th({ children, sorted, onSort, className, tooltip }: ThProps) {
  const tooltipIcon = tooltip ? (
    <span className="ml-1 text-muted-foreground/50 cursor-help inline-flex" title={tooltip}>
      <HelpCircle size={12} />
    </span>
  ) : null

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
        {tooltipIcon}
      </th>
    )
  }

  return (
    <th scope="col" className={`${TH_BASE} ${className || ''}`}>
      <span className="inline-flex items-center">
        {children}
        {tooltipIcon}
      </span>
    </th>
  )
})
