'use client'

import { useEffect, useRef } from 'react'
import { useAlertCounts } from '@/hooks/use-api'

function drawFavicon(hasCritical: boolean): string {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Background — rounded square
  ctx.beginPath()
  const r = 12
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#1b6cf5')   // primary
  grad.addColorStop(1, '#d4a843')   // gold
  ctx.fillStyle = grad
  ctx.fill()

  // Bar chart icon (3 bars)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  const barW = 8
  const gap = 5
  const startX = 15
  const bars = [28, 20, 34]
  bars.forEach((h, i) => {
    const x = startX + i * (barW + gap)
    const y = size - 12 - h
    ctx.beginPath()
    ctx.roundRect(x, y, barW, h, 2)
    ctx.fill()
  })

  // Red alert dot
  if (hasCritical) {
    const dotR = 10
    const cx = size - dotR + 2
    const cy = dotR - 2
    // White outline
    ctx.beginPath()
    ctx.arc(cx, cy, dotR + 2, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    // Red dot
    ctx.beginPath()
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    // Exclamation mark
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', cx, cy + 0.5)
  }

  return canvas.toDataURL('image/png')
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/png'
    document.head.appendChild(link)
  }
  link.href = href
}

export function DynamicFavicon() {
  const { data: badges = {} } = useAlertCounts()
  const prevCritical = useRef<boolean | null>(null)

  useEffect(() => {
    const criticalKeys = ['scoring', 'fraude', 'cobros', 'deuda']
    const hasCritical = criticalKeys.some(k => (badges as any)[k] > 0)

    // Only redraw if state changed
    if (prevCritical.current === hasCritical) return
    prevCritical.current = hasCritical

    const dataUrl = drawFavicon(hasCritical)
    setFavicon(dataUrl)
  }, [badges])

  // Draw initial favicon on mount
  useEffect(() => {
    setFavicon(drawFavicon(false))
  }, [])

  return null
}
