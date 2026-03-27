'use client'

import { useEffect } from 'react'

export function ScrollElevation() {
  useEffect(() => {
    const root = document.getElementById('main-content')
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            observer.unobserve(entry.target)
          }
        }
      },
      { root, threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )

    function observeCards() {
      root!.querySelectorAll('.card-base, .kpi-card').forEach((el) => {
        if (!el.classList.contains('in-view') && !el.hasAttribute('data-scroll-observed')) {
          el.setAttribute('data-scroll-observed', '1')
          observer.observe(el)
        }
      })
    }

    observeCards()

    const mutation = new MutationObserver(observeCards)
    mutation.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutation.disconnect()
    }
  }, [])

  return null
}
