'use client'

import { AlertOctagon } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  compact?: boolean
}

export function ErrorState({
  title = 'Error al cargar los datos',
  description = 'Ha ocurrido un problema al conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
  className,
  compact,
}: ErrorStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'py-16',
      'animate-in fade-in duration-500',
      className,
    )}>
      {/* Icon container with pulse ring */}
      <div className={cn(
        'relative flex items-center justify-center mb-5',
        compact ? 'w-16 h-16' : 'w-24 h-24',
      )}>
        <div className="absolute inset-0 rounded-full bg-destructive/10 animate-ping [animation-duration:2.5s]" />
        <div className={cn(
          'relative rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center',
          compact ? 'w-14 h-14' : 'w-20 h-20',
        )}>
          <AlertOctagon className={cn('text-destructive', compact ? 'w-6 h-6' : 'w-8 h-8')} />
        </div>
      </div>

      <p className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>{title}</p>
      {description && (
        <p className={cn(
          'mt-1.5 max-w-[340px] leading-relaxed text-muted-foreground',
          compact ? 'text-[10px]' : 'text-xs',
        )}>
          {description}
        </p>
      )}
      {onRetry && (
        <Button size="sm" variant="destructive" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
