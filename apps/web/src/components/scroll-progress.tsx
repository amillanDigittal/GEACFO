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
    <div className="h-[2px] bg-muted/30 sticky top-0 z-30 print:hidden" data-print-hide>
      <div
        className="h-full bg-primary/60 transition-[width] duration-75 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
