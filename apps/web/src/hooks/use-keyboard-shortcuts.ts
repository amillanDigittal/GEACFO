'use client'

import { useEffect, useRef } from 'react'

export interface KeyboardShortcut {
  /** Single key (lowercase). Modifiers not supported — those go through Command Palette. */
  key: string
  /** Short label shown in the help overlay */
  label: string
  /** Callback. Return false to indicate "not handled" (e.g. precondition not met). */
  action: () => void | false
}

/**
 * Registers page-level keyboard shortcuts.
 * Shortcuts are suppressed when focus is inside an input, textarea, select,
 * contenteditable, or when a dialog/modal is open.
 *
 * Call from any page component — shortcuts are cleaned up on unmount.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when modifier keys are held (those are for Command Palette / browser)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Ignore when focus is inside form elements
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      // Ignore when a dialog/modal is open (radix portals use [role=dialog])
      if (document.querySelector('[role="dialog"]')) return

      const key = e.key.toLowerCase()
      const shortcut = ref.current.find(s => s.key === key)
      if (shortcut) {
        e.preventDefault()
        shortcut.action()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

/**
 * Global event to request showing the shortcuts help overlay.
 * Dispatched when user presses '?' and listened by the ShortcutsHelp component.
 */
export const SHORTCUTS_HELP_EVENT = 'geacfo:shortcuts-help'
