'use client'

import { useEffect } from 'react'

/**
 * Dashboard-level error boundary — keeps sidebar and topbar visible
 * so the user can navigate away or retry.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Dashboard error boundary:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Error al cargar esta sección</h2>
      <p className="text-sm text-muted-foreground mb-1 max-w-md">
        Ha ocurrido un error inesperado. Puedes reintentar o navegar a otra sección con el menú lateral.
      </p>
      {error.message && (
        <p className="text-xs text-muted-foreground/60 font-mono mb-6 max-w-md break-all">
          {error.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm"
        >
          Reintentar
        </button>
        <a
          href="/dashboard/cockpit"
          className="border border-border text-foreground font-semibold py-2 px-4 rounded-lg hover:bg-muted transition-colors text-sm"
        >
          Ir al Cockpit
        </a>
      </div>
    </div>
  )
}
