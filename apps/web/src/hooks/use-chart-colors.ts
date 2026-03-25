'use client'

import { useTheme } from 'next-themes'
import { useMemo, useState, useEffect } from 'react'

/**
 * Resolves CSS custom properties to actual hsl() strings that Recharts
 * can use as fill/stroke values. Returns new object references when the
 * theme changes, which forces Recharts components to re-render with
 * the correct colors.
 *
 * Usage:
 *   const c = useChartColors()
 *   <Bar fill={c.primary} />
 *   <CartesianGrid stroke={c.border} />
 */

const VARS = [
  'primary', 'destructive', 'success', 'warning',
  'muted', 'muted-foreground', 'border', 'foreground',
  'card', 'card-foreground',
  'chart-blue', 'chart-purple', 'chart-teal',
  'bank-bbva', 'bank-santander', 'bank-caixabank', 'bank-sabadell',
] as const

type ChartColorKey = (typeof VARS)[number]
/** Camel-cased key type: 'muted-foreground' -> 'mutedForeground' */
type CamelKey<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<CamelKey<B>>}` : S
type ChartColors = { [K in ChartColorKey as CamelKey<K>]: string }

function toCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function resolve(): ChartColors {
  const style = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null

  const colors = {} as Record<string, string>
  for (const v of VARS) {
    const raw = style?.getPropertyValue(`--${v}`).trim() || ''
    colors[toCamel(v)] = raw ? `hsl(${raw})` : `hsl(var(--${v}))`
  }
  return colors as ChartColors
}

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme()
  const [colors, setColors] = useState<ChartColors>(resolve)

  useEffect(() => {
    // Re-resolve after theme changes (CSS vars have updated by now)
    const frame = requestAnimationFrame(() => setColors(resolve()))
    return () => cancelAnimationFrame(frame)
  }, [resolvedTheme])

  return colors
}
