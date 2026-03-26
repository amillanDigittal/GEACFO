'use client'

function Bone({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />
}

/** Wraps skeleton layouts with a subtle fade-in so they don't pop in abruptly */
function SkeletonWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="skeleton-wrapper animate-in fade-in duration-200">
      {children}
    </div>
  )
}

function SkeletonKPI() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center space-y-2">
      <Bone className="h-2.5 w-16 mx-auto" />
      <Bone className="h-6 w-24 mx-auto" />
    </div>
  )
}

function SkeletonCard({ height = 'h-[200px]' }: { height?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <Bone className="h-4 w-40" />
      <Bone className="h-2.5 w-60" />
      <Bone className={`w-full rounded-lg ${height}`} />
    </div>
  )
}

function SkeletonTableRow({ cols }: { cols: number }) {
  return (
    <div className="flex gap-4 py-3 border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <Bone key={i} className="h-3 flex-1" />
      ))}
    </div>
  )
}

function SkeletonTable({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-1">
      <Bone className="h-4 w-40 mb-3" />
      <div className="flex gap-4 py-2 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-2 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </div>
  )
}

/** Header + subtitle skeleton */
function SkeletonHeader() {
  return (
    <div className="space-y-2">
      <Bone className="h-6 w-48" />
      <Bone className="h-3 w-72" />
    </div>
  )
}

/** 4 KPI cards row */
function SkeletonKPIRow({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKPI key={i} />
      ))}
    </div>
  )
}

// ─── Page-specific skeletons ─────────────────────────────────────────

/** Cockpit: header + 8 KPI cards + chart + 2 cards side-by-side */
export function SkeletonCockpit() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <SkeletonCard height="h-[300px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[180px]" />
        <SkeletonCard height="h-[180px]" />
      </div>
    </div></SkeletonWrapper>
  )
}

/** Forecast: header + KPIs + tabs + chart + table */
export function SkeletonForecast() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="flex gap-2">
        <Bone className="h-9 w-48 rounded-lg" />
        <Bone className="h-9 w-48 rounded-lg" />
      </div>
      <SkeletonCard height="h-[320px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[280px]" />
        <SkeletonCard height="h-[200px]" />
      </div>
    </div></SkeletonWrapper>
  )
}

/** Pages with KPIs + table (cobros, pagos, inventario, scoring, gobierno) */
export function SkeletonKPIsAndTable({ kpis = 4, cols = 6, rows = 6 }: { kpis?: number; cols?: number; rows?: number }) {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow count={kpis} />
      <SkeletonTable cols={cols} rows={rows} />
    </div></SkeletonWrapper>
  )
}

/** Deuda: KPIs + 2 charts + 2 cards (table + covenants) */
export function SkeletonDeuda() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[320px]" />
        <SkeletonCard height="h-[320px]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonTable cols={5} rows={3} />
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <Bone className="h-4 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <Bone className="h-3 w-32" />
                <Bone className="h-5 w-12 rounded-full" />
              </div>
              <Bone className="h-1.5 w-full rounded-full" />
              <Bone className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div></SkeletonWrapper>
  )
}

/** Conciliacion: KPIs + 2 account cards + table */
export function SkeletonConciliacion() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard height="h-[120px]" />
        <SkeletonCard height="h-[120px]" />
      </div>
      <SkeletonCard height="h-[80px]" />
      <SkeletonTable cols={8} rows={6} />
    </div></SkeletonWrapper>
  )
}

/** Escenarios: header + 3 scenario cards + chart + table */
export function SkeletonEscenarios() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonCard height="h-[100px]" />
        <SkeletonCard height="h-[100px]" />
        <SkeletonCard height="h-[100px]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[300px]" />
        <SkeletonCard height="h-[300px]" />
      </div>
      <SkeletonTable cols={6} rows={5} />
    </div></SkeletonWrapper>
  )
}

/** Variance: KPIs + 2 charts + table */
export function SkeletonVariance() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[300px]" />
        <SkeletonCard height="h-[300px]" />
      </div>
      <SkeletonTable cols={7} rows={5} />
    </div></SkeletonWrapper>
  )
}

/** Fraude: KPIs + 3 cards + tables */
export function SkeletonFraude() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard height="h-[150px]" />
        <SkeletonCard height="h-[150px]" />
        <SkeletonCard height="h-[150px]" />
      </div>
      <SkeletonTable cols={6} rows={4} />
    </div></SkeletonWrapper>
  )
}

/** Provisiones: header + 4 KPIs + table (matrix) + 2 charts */
export function SkeletonProvisiones() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <SkeletonTable cols={7} rows={6} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[280px]" />
        <SkeletonCard height="h-[280px]" />
      </div>
    </div></SkeletonWrapper>
  )
}

/** Proyección Diaria: header + 5 KPIs + big chart + table + side card */
export function SkeletonProyeccionDiaria() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <SkeletonCard height="h-[350px]" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><SkeletonTable cols={6} rows={8} /></div>
        <SkeletonCard height="h-[300px]" />
      </div>
    </div></SkeletonWrapper>
  )
}

/** Inventario ABC: header + 3 summary cards + 2 charts + table */
export function SkeletonInventarioABC() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
            <Bone className="h-5 w-16 mx-auto" />
            <Bone className="h-8 w-20 mx-auto" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, j) => <Bone key={j} className="h-10 rounded-lg" />)}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[280px]" />
        <SkeletonCard height="h-[280px]" />
      </div>
      <SkeletonTable cols={8} rows={6} />
    </div></SkeletonWrapper>
  )
}

/** Presupuesto: header + year nav + 4 KPIs + wide grid table + 2 charts */
export function SkeletonPresupuesto() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="bg-card border border-border rounded-xl p-5 space-y-2">
        <div className="flex justify-between mb-3">
          <Bone className="h-4 w-48" />
          <Bone className="h-5 w-20 rounded-full" />
        </div>
        {/* 14-column grid mimicking the monthly budget table */}
        <div className="flex gap-2 py-2 border-b border-border">
          <Bone className="h-2 w-[160px] flex-shrink-0" />
          {Array.from({ length: 13 }).map((_, i) => <Bone key={i} className="h-2 w-[100px] flex-shrink-0" />)}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-2 py-2.5 border-b border-border">
            <Bone className="h-3 w-[160px] flex-shrink-0" />
            {Array.from({ length: 13 }).map((_, j) => <Bone key={j} className="h-6 w-[100px] flex-shrink-0 rounded" />)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[280px]" />
        <SkeletonCard height="h-[280px]" />
      </div>
    </div></SkeletonWrapper>
  )
}

/** Configuración: header + section tabs + settings card */
export function SkeletonConfiguracion() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => <Bone key={i} className="h-9 w-28 rounded-lg" />)}
      </div>
      <div className="bg-card border border-border rounded-xl p-5 space-y-1">
        <div className="flex justify-between mb-4">
          <Bone className="h-5 w-44" />
          <Bone className="h-8 w-24 rounded-md" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border">
            <div className="space-y-1.5">
              <Bone className="h-3 w-36" />
              <Bone className="h-2 w-56" />
            </div>
            <Bone className="h-8 w-48 rounded-md" />
          </div>
        ))}
      </div>
    </div></SkeletonWrapper>
  )
}

/** Usuarios: header + 5 role KPIs + search + user cards grid */
export function SkeletonUsuarios() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <Bone className="h-9 w-64 rounded-md" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Bone className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-3.5 w-32" />
                <Bone className="h-2.5 w-44" />
                <Bone className="h-2 w-28" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Bone className="h-2 w-36" />
              <div className="flex gap-1">
                <Bone className="h-7 w-7 rounded" />
                <Bone className="h-7 w-7 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div></SkeletonWrapper>
  )
}

/** Board Pack: header + nav tabs + card with KPIs */
export function SkeletonBoardPack() {
  return (
    <SkeletonWrapper><div className="space-y-6">
      <SkeletonHeader />
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-9 w-36 rounded-lg" />
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <Bone className="h-4 w-48" />
        <Bone className="h-12 w-full rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i} />)}
        </div>
      </div>
    </div></SkeletonWrapper>
  )
}
