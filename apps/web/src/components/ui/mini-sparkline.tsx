'use client'

import { memo } from 'react'

interface MiniSparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export const MiniSparkline = memo(function MiniSparkline({
  data,
  width = 48,
  height = 16,
  color = 'hsl(var(--primary))',
  className,
}: MiniSparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 1

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * (height - pad * 2) - pad
      return `${x},${y}`
    })
    .join(' ')

  const trend = data[data.length - 1] - data[0]

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - pad * 2) - pad}
        r="2"
        fill={color}
      />
    </svg>
  )
})
