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
    ar: (from?: string, to?: string) => fetchAPI(`/treasury/ar${from || to ? `?${from ? `from=${from}` : ''}${from && to ? '&' : ''}${to ? `to=${to}` : ''}` : ''}`),
    ap: (from?: string, to?: string) => fetchAPI(`/treasury/ap${from || to ? `?${from ? `from=${from}` : ''}${from && to ? '&' : ''}${to ? `to=${to}` : ''}` : ''}`),
    approveAP: (id: string) => fetchAPI(`/treasury/ap/${id}/approve`, { method: 'PATCH' }),
    approveAPBatch: (ids: string[]) => fetchAPI('/treasury/ap/approve-batch', { method: 'POST', body: JSON.stringify({ ids }) }),
    rejectAP: (id: string, reason?: string) => fetchAPI(`/treasury/ap/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    accounts: () => fetchAPI('/treasury/accounts'),
    cashflow: (from?: string, to?: string) => fetchAPI(`/treasury/cashflow${from || to ? `?${from ? `from=${from}` : ''}${from && to ? '&' : ''}${to ? `to=${to}` : ''}` : ''}`),
    ratios: () => fetchAPI('/treasury/ratios'),
    autoMatch: () => fetchAPI('/treasury/auto-match'),
    reconciliation: () => fetchAPI('/treasury/reconciliation'),
    recategorize: () => fetchAPI('/treasury/movements/recategorize', { method: 'POST' }),
    categories: () => fetchAPI('/treasury/movements/categories'),
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
  inventory: { list: () => fetchAPI('/inventory'), abc: () => fetchAPI('/inventory/abc') },
  scenarios: {
    compare: () => fetchAPI('/scenarios/compare'),
    simulate: (params: any) => fetchAPI('/scenarios/simulate', { method: 'POST', body: JSON.stringify(params) }),
    variance: () => fetchAPI('/scenarios/variance'),
  },
  bot: {
    chat: (message: string, sessionId: string, context?: string) => fetchAPI('/bot/chat', { method: 'POST', body: JSON.stringify({ message, sessionId, context }) }),
    history: (sessionId: string) => fetchAPI(`/bot/history?sessionId=${sessionId}`),
    recommendations: () => fetchAPI('/bot/recommendations'),
    sessions: () => fetchAPI('/bot/sessions'),
  },
  alerts: {
    counts: () => fetchAPI('/alerts/counts'),
    notifications: () => fetchAPI('/alerts/notifications'),
    predictive: () => fetchAPI('/alerts/predictive'),
    resolutions: () => fetchAPI('/alerts/resolutions'),
    updateResolution: (alertId: string, status: string, notes?: string) =>
      fetchAPI('/alerts/resolutions', { method: 'POST', body: JSON.stringify({ alertId, status, notes }) }),
  },
  users: {
    list: () => fetchAPI('/users'),
    get: (id: string) => fetchAPI(`/users/${id}`),
    create: (data: { email: string; name: string; role: string; password: string }) => fetchAPI('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { email?: string; name?: string; role?: string; password?: string }) => fetchAPI(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => fetchAPI(`/users/${id}`, { method: 'DELETE' }),
  },
  settings: {
    getTenant: () => fetchAPI('/settings/tenant'),
    updateTenant: (data: any) => fetchAPI('/settings/tenant', { method: 'PATCH', body: JSON.stringify(data) }),
    getConfig: () => fetchAPI('/settings/config'),
    updateConfig: (data: any) => fetchAPI('/settings/config', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  reporting: {
    list: () => fetchAPI('/reporting/schedules'),
    create: (data: { name: string; reportType: string; frequency: string; recipients: string }) => fetchAPI('/reporting/schedules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/reporting/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => fetchAPI(`/reporting/schedules/${id}`, { method: 'DELETE' }),
    send: (id: string) => fetchAPI(`/reporting/schedules/${id}/send`, { method: 'POST' }),
  },
  budget: {
    get: (year?: number) => fetchAPI(`/budget${year ? `?year=${year}` : ''}`),
    upsertLines: (year: number, lines: { month: number; category: string; amount: number }[]) =>
      fetchAPI('/budget/lines', { method: 'POST', body: JSON.stringify({ year, lines }) }),
    init: (year: number) => fetchAPI('/budget/init', { method: 'POST', body: JSON.stringify({ year }) }),
    variance: (year?: number) => fetchAPI(`/budget/variance${year ? `?year=${year}` : ''}`),
  },
  provisions: {
    matrix: () => fetchAPI('/provisions/matrix'),
    saveSnapshot: () => fetchAPI('/provisions/snapshot', { method: 'POST' }),
    snapshots: () => fetchAPI('/provisions/snapshots'),
  },
  suppliers: {
    list: () => fetchAPI('/suppliers'),
    get: (id: string) => fetchAPI(`/suppliers/${id}`),
    create: (data: any) => fetchAPI('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => fetchAPI(`/suppliers/${id}`, { method: 'DELETE' }),
    recalculate: (id: string) => fetchAPI(`/suppliers/${id}/recalculate`, { method: 'POST' }),
    recalculateAll: () => fetchAPI('/suppliers/recalculate-all', { method: 'POST' }),
  },
  import: {
    templates: () => fetchAPI('/import/templates'),
    movements: (accountAlias: string, rows: any[]) => fetchAPI('/import/movements', { method: 'POST', body: JSON.stringify({ accountAlias, rows }) }),
    invoicesAR: (rows: any[]) => fetchAPI('/import/invoices-ar', { method: 'POST', body: JSON.stringify({ rows }) }),
    invoicesAP: (rows: any[]) => fetchAPI('/import/invoices-ap', { method: 'POST', body: JSON.stringify({ rows }) }),
    inventory: (rows: any[]) => fetchAPI('/import/inventory', { method: 'POST', body: JSON.stringify({ rows }) }),
  },
  board: { pack: () => fetchAPI('/board/pack') },
  governance: {
    sources: () => fetchAPI('/governance/sources'),
    audit: () => fetchAPI('/governance/audit'),
  },
}
