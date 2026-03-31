'use client'
import { useRef, useState, useEffect, type ReactNode } from 'react'

export function LazySection({ children, fallback, rootMargin = '200px' }: { children: ReactNode; fallback?: ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return <div ref={ref}>{visible ? children : (fallback || <div className="h-64 bg-muted/20 rounded-xl animate-pulse" />)}</div>
}
