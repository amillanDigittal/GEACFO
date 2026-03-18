async function fetchAPI(path: string, options: RequestInit = {}) {
  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 401) {
    window.location.href = '/auth/login'
    throw new Error('Sesión expirada')
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error de red' }))
    throw new Error(error.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: (path: string) => fetchAPI(path),
  post: (path: string, body: any) => fetchAPI(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path: string, body?: any) => fetchAPI(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  auth: {
    login: (email: string, password: string) => fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => fetchAPI('/auth/me'),
  },
  treasury: {
    cockpit: () => fetchAPI('/treasury/cockpit'),
    forecast: (scenario?: string) => fetchAPI(`/treasury/forecast${scenario ? `?scenario=${scenario}` : ''}`),
    forecastCompare: () => fetchAPI('/treasury/forecast/compare'),
    ar: () => fetchAPI('/treasury/ar'),
    ap: () => fetchAPI('/treasury/ap'),
    approveAP: (id: string) => fetchAPI(`/treasury/ap/${id}/approve`, { method: 'PATCH' }),
    approveAPBatch: (ids: string[]) => fetchAPI('/treasury/ap/approve-batch', { method: 'POST', body: JSON.stringify({ ids }) }),
    accounts: () => fetchAPI('/treasury/accounts'),
    reconciliation: () => fetchAPI('/treasury/reconciliation'),
    reconcileMovement: (id: string) => fetchAPI(`/treasury/movements/${id}/reconcile`, { method: 'PATCH' }),
    reconcileBatch: (ids: string[]) => fetchAPI('/treasury/movements/reconcile-batch', { method: 'POST', body: JSON.stringify({ ids }) }),
  },
  customers: {
    list: () => fetchAPI('/customers'),
    get: (id: string) => fetchAPI(`/customers/${id}`),
    recalculate: (id: string) => fetchAPI(`/customers/${id}/recalculate-score`, { method: 'POST' }),
  },
  debt: {
    summary: () => fetchAPI('/debt/summary'),
    instruments: () => fetchAPI('/debt/instruments'),
    covenants: () => fetchAPI('/debt/covenants'),
    amortization: () => fetchAPI('/debt/amortization'),
  },
  inventory: { list: () => fetchAPI('/inventory') },
  scenarios: {
    compare: () => fetchAPI('/scenarios/compare'),
    simulate: (params: any) => fetchAPI('/scenarios/simulate', { method: 'POST', body: JSON.stringify(params) }),
    variance: () => fetchAPI('/scenarios/variance'),
  },
  bot: {
    chat: (message: string, sessionId: string, context?: string) => fetchAPI('/bot/chat', { method: 'POST', body: JSON.stringify({ message, sessionId, context }) }),
    history: (sessionId: string) => fetchAPI(`/bot/history?sessionId=${sessionId}`),
  },
  alerts: {
    counts: () => fetchAPI('/alerts/counts'),
    notifications: () => fetchAPI('/alerts/notifications'),
    resolutions: () => fetchAPI('/alerts/resolutions'),
    updateResolution: (alertId: string, status: string, notes?: string) =>
      fetchAPI('/alerts/resolutions', { method: 'POST', body: JSON.stringify({ alertId, status, notes }) }),
  },
  board: { pack: () => fetchAPI('/board/pack') },
  governance: {
    sources: () => fetchAPI('/governance/sources'),
    audit: () => fetchAPI('/governance/audit'),
  },
}
