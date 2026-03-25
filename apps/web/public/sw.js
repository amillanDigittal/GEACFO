/// <reference lib="webworker" />

const CACHE_NAME = 'geacfo-api-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only cache API routes (both /api/v1/* and /api/health)
  if (!url.pathname.startsWith('/api/')) return

  event.respondWith(networkFirst(request))
})

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      // Store a clone with the cached-at timestamp
      const clone = response.clone()
      const body = await clone.blob()
      const headers = new Headers(clone.headers)
      headers.set('x-sw-cached-at', new Date().toISOString())
      cache.put(request, new Response(body, {
        status: clone.status,
        statusText: clone.statusText,
        headers,
      }))
    }
    return response
  } catch {
    // Network failed — serve from cache
    const cached = await caches.match(request)
    if (cached) return cached
    // Nothing cached — let the error propagate to SWR / fetchAPI
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json', 'x-sw-cached-at': '' },
    })
  }
}
