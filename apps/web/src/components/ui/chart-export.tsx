'use client'
import { useCallback } from 'react'
import { Download } from 'lucide-react'

export function ChartExportButton({ chartRef, filename }: { chartRef: React.RefObject<HTMLDivElement>; filename: string }) {
  const exportChart = useCallback(async () => {
    const el = chartRef.current
    if (!el) return
    try {
      // Find the SVG inside the Recharts container
      const svg = el.querySelector('svg.recharts-surface')
      if (!svg) return

      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.svg`
      link.click()
      URL.revokeObjectURL(url)
    } catch {}
  }, [chartRef, filename])

  return (
    <button
      onClick={exportChart}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
      aria-label={`Descargar gráfico ${filename}`}
      title="Descargar gráfico"
    >
      <Download size={14} />
    </button>
  )
}
