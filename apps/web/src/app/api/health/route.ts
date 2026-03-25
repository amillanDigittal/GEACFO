import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/** Lightweight proxy to NestJS /health — no auth required */
export async function GET() {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 502 })
  }
}
