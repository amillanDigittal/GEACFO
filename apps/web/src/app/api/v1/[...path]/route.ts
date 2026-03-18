import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const dynamic = 'force-dynamic'

async function proxyRequest(req: NextRequest) {
  const path = req.nextUrl.pathname
  const search = req.nextUrl.search
  const target = `${API_URL}${path}${search}`

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token?.accessToken) {
    headers['Authorization'] = `Bearer ${token.accessToken}`
  }

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined

  const apiRes = await fetch(target, {
    method: req.method,
    headers,
    body,
    cache: 'no-store',
  })

  const data = await apiRes.text()
  return new NextResponse(data, {
    status: apiRes.status,
    headers: { 'Content-Type': apiRes.headers.get('Content-Type') || 'application/json' },
  })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
