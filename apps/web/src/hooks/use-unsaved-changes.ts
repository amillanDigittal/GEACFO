'use client'

import { useEffect, useCallback } from 'react'

/**
 * Warns the user when they try to leave a page with unsaved changes.
 * Handles:
 * - Browser tab close / reload (beforeunload)
 * - Back/forward navigation (popstate)
 */
export function useUnsavedChanges(dirty: boolean) {
  // Browser close/reload
  useEffect(() => {
    if (!dirty) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Chrome requires returnValue to be set
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  // Programmatic navigation guard — returns true if safe to navigate
  const confirmLeave = useCallback(() => {
    if (!dirty) return true
    return window.confirm('Tienes cambios sin guardar. ¿Quieres salir sin guardar?')
  }, [dirty])

  return { confirmLeave }
}
