'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useFocusTrap } from '@/hooks/use-focus-trap'

/**
 * Monitors JWT session health and shows a modal when the token expires.
 * Two triggers:
 * 1. NextAuth session.error === 'TokenExpired' (server-side detection via jwt callback)
 * 2. Custom event 'geacfo:session-expired' (client-side 401 from API calls)
 */
export function SessionGuard() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [expired, setExpired] = useState(false)
  const trapRef = useFocusTrap<HTMLDivElement>(expired)

  // Skip on login page
  const isLoginPage = pathname?.startsWith('/auth')

  // Listen for 401 events from fetchAPI
  useEffect(() => {
    function handleExpired() { setExpired(true) }
    window.addEventListener('geacfo:session-expired', handleExpired)
    return () => window.removeEventListener('geacfo:session-expired', handleExpired)
  }, [])

  // Check NextAuth session error (set by jwt callback when refresh fails)
  useEffect(() => {
    if ((session as any)?.error === 'TokenExpired') {
      setExpired(true)
    }
  }, [(session as any)?.error])

  if (isLoginPage || !expired) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div ref={trapRef} role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title" className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h2 id="session-expired-title" className="text-lg font-semibold text-foreground mb-1">Sesión expirada</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Tu sesión ha caducado por inactividad. Inicia sesión de nuevo para continuar.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="w-full bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-colors"
        >
          Iniciar sesión
        </button>
      </div>
    </div>
  )
}
