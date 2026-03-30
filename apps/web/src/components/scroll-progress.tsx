'use client'

import { useEffect, useState } from 'react'

export function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return

    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = main!
      const max = scrollHeight - clientHeight
      setProgress(max > 0 ? (scrollTop / max) * 100 : 0)
    }

    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  if (progress <= 0) return null

  return (
    <div className="sticky top-[60px] z-50 h-[3px] bg-muted/20 print:hidden" data-print-hide>
      <div
        className="h-full transition-[width] duration-75 ease-linear"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--gold)))',
          boxShadow: '0 0 8px hsl(var(--primary) / 0.4), 0 0 2px hsl(var(--primary) / 0.6)',
        }}
      />
    </div>
  )
}
