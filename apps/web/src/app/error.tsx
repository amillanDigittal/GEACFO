'use client'

import { useEffect } from 'react'

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Root error boundary:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Error inesperado</h1>
        <p className="text-sm text-muted-foreground mb-1">
          Algo ha fallado al cargar la página.
        </p>
        {error.message && (
          <p className="text-xs text-muted-foreground/70 font-mono mb-6 break-all">
            {error.message}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Reintentar
          </button>
          <a
            href="/dashboard/cockpit"
            className="border border-border text-foreground font-semibold py-2.5 px-5 rounded-lg hover:bg-muted transition-colors text-sm"
          >
            Ir al Cockpit
          </a>
        </div>
      </div>
    </div>
  )
}
