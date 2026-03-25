import Link from 'next/link'

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl font-mono font-bold text-muted-foreground/20 mb-4">404</div>
      <h1 className="text-lg font-semibold text-foreground mb-1">Sección no encontrada</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Esta página no existe en el dashboard. Usa el menú lateral para navegar.
      </p>
      <Link
        href="/dashboard/cockpit"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm"
      >
        Volver al Cockpit
      </Link>
    </div>
  )
}
