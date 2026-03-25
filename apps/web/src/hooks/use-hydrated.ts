'use client'

import { useState, useEffect } from 'react'

/**
 * Returns `false` on the server and on the very first client render (before hydration),
 * then `true` after the initial useEffect fires. Use this to defer rendering of
 * content that depends on client-only state (SWR cache, localStorage, etc.)
 * and would cause a hydration mismatch.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  return hydrated
}
