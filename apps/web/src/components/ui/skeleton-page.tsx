'use client'

function Bone({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />
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
    <div className="space-y-6">
      <SkeletonHeader />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <SkeletonCard height="h-[300px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[180px]" />
        <SkeletonCard height="h-[180px]" />
      </div>
    </div>
  )
}

/** Forecast: header + KPIs + tabs + chart + table */
export function SkeletonForecast() {
  return (
    <div className="space-y-6">
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
    </div>
  )
}

/** Pages with KPIs + table (cobros, pagos, inventario, scoring, gobierno) */
export function SkeletonKPIsAndTable({ kpis = 4, cols = 6, rows = 6 }: { kpis?: number; cols?: number; rows?: number }) {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow count={kpis} />
      <SkeletonTable cols={cols} rows={rows} />
    </div>
  )
}

/** Deuda: KPIs + 2 charts + 2 cards (table + covenants) */
export function SkeletonDeuda() {
  return (
    <div className="space-y-6">
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
    </div>
  )
}

/** Conciliacion: KPIs + 2 account cards + table */
export function SkeletonConciliacion() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard height="h-[120px]" />
        <SkeletonCard height="h-[120px]" />
      </div>
      <SkeletonCard height="h-[80px]" />
      <SkeletonTable cols={8} rows={6} />
    </div>
  )
}

/** Escenarios: header + 3 scenario cards + chart + table */
export function SkeletonEscenarios() {
  return (
    <div className="space-y-6">
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
    </div>
  )
}

/** Variance: KPIs + 2 charts + table */
export function SkeletonVariance() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-[300px]" />
        <SkeletonCard height="h-[300px]" />
      </div>
      <SkeletonTable cols={7} rows={5} />
    </div>
  )
}

/** Fraude: KPIs + 3 cards + tables */
export function SkeletonFraude() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonKPIRow />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard height="h-[150px]" />
        <SkeletonCard height="h-[150px]" />
        <SkeletonCard height="h-[150px]" />
      </div>
      <SkeletonTable cols={6} rows={4} />
    </div>
  )
}

/** Board Pack: header + nav tabs + card with KPIs */
export function SkeletonBoardPack() {
  return (
    <div className="space-y-6">
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
    </div>
  )
}
