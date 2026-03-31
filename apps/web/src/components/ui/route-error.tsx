'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/error-state'

interface RouteErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  section: string
}

export function RouteError({ error, reset, section }: RouteErrorProps) {
  useEffect(() => {
    console.error(`[${section}] error boundary:`, error)
  }, [error, section])

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <ErrorState
        title={`Error al cargar ${section}`}
        description={error.message || 'Ha ocurrido un error inesperado. Puedes reintentar o navegar a otra sección.'}
        onRetry={reset}
        retryLabel="Reintentar"
      />
      <a
        href="/dashboard/cockpit"
        className="mt-2 border border-border text-foreground font-semibold py-2 px-4 rounded-lg hover:bg-muted transition-colors text-sm"
      >
        Ir al Cockpit
      </a>
    </div>
  )
}
