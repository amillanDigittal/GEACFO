'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps focus inside the referenced container while active.
 * Restores focus to the previously focused element when deactivated.
 *
 * @param active  Pass `true` when the modal is open, `false` when closed.
 * @param autoFocus  Focus the first focusable element on activation (default true).
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  autoFocus = true,
): RefObject<T> {
  const ref = useRef<T>(null!)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Auto-focus first focusable element
    if (autoFocus) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return

      const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (nodes.length === 0) return

      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [active, autoFocus])

  return ref
}
