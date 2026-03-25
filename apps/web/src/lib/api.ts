import { toast } from '@/components/ui/use-toast'

// ── Last successful fetch tracker (read by ConnectionBanner) ────────
let _lastFetchAt: number = Date.now()
export function getLastFetchAt() { return _lastFetchAt }

// ── Custom error with HTTP context ──────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── User-friendly messages per status ───────────────────────────────
const STATUS_MESSAGES: Record<number, { message: string; code: string }> = {
  400: { message: 'Datos inválidos. Revisa los campos e inténtalo de nuevo.', code: 'BAD_REQUEST' },
  401: { message: 'Sesión expirada', code: 'UNAUTHORIZED' },
  403: { message: 'No tienes permisos para realizar esta acción.', code: 'FORBIDDEN' },
  404: { message: 'El recurso solicitado no existe.', code: 'NOT_FOUND' },
  409: { message: 'Conflicto: el recurso ya existe o fue modificado por otro usuario.', code: 'CONFLICT' },
  422: { message: 'Los datos enviados no son válidos.', code: 'VALIDATION' },
  429: { message: 'Demasiadas peticiones. Espera un momento antes de reintentar.', code: 'RATE_LIMIT' },
  500: { message: 'Error interno del servidor. Inténtalo de nuevo más tarde.', code: 'SERVER_ERROR' },
  502: { message: 'El servidor no está disponible. Inténtalo en unos minutos.', code: 'BAD_GATEWAY' },
  503: { message: 'Servicio en mantenimiento. Inténtalo en unos minutos.', code: 'SERVICE_UNAVAILABLE' },
  504: { message: 'El servidor tardó demasiado en responder.', code: 'GATEWAY_TIMEOUT' },
}

// ── Timeout wrapper ─────────────────────────────────────────────────
const DEFAULT_TIMEOUT = 30_000 // 30 seconds

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// ── Core fetch function ─────────────────────────────────────────────
async function fetchAPI(path: string, options: RequestInit = {}) {
  let res: Response

  try {
    res = await fetchWithTimeout(`/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }, DEFAULT_TIMEOUT)
  } catch (err: any) {
    // Network error or timeout
    if (err.name === 'AbortError') {
      throw new ApiError(
        'La petición ha tardado demasiado. Comprueba tu conexión e inténtalo de nuevo.',
        0,
        'TIMEOUT',
      )
    }
    throw new ApiError(
      'No se pudo conectar con el servidor. Comprueba tu conexión a internet.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (res.ok) {
    // Track last successful live fetch (ignore service-worker cached responses)
    const cachedAt = res.headers.get('x-sw-cached-at')
    if (!cachedAt) {
      _lastFetchAt = Date.now()
    }
    return res.json()
  }

  // ── Handle specific status codes ──────────────────────────────
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('geacfo:session-expired'))
    }
    throw new ApiError('Sesión expirada', 401, 'UNAUTHORIZED')
  }

  // Try to extract API error message from response body
  let serverMessage: string | undefined
  try {
    const body = await res.json()
    serverMessage = body.message
  } catch {}

  const fallback = STATUS_MESSAGES[res.status] || { message: `Error HTTP ${res.status}`, code: 'UNKNOWN' }
  // Use server message for 400/422 (validation) since it has field-level detail
  const message = (res.status === 400 || res.status === 422) && serverMessage
    ? serverMessage
    : fallback.message

  throw new ApiError(message, res.status, fallback.code)
}

// ── Global SWR error handler ────────────────────────────────────────
export function onApiError(error: Error) {
  // Don't toast for 401 — SessionGuard handles it
  if (error instanceof ApiError && error.status === 401) return

  toast({
    title: error instanceof ApiError ? errorTitle(error.code) : 'Error',
    description: error.message,
    variant: 'destructive',
  })
}

function errorTitle(code: string): string {
  switch (code) {
    case 'NETWORK_ERROR': return 'Sin conexión'
    case 'TIMEOUT': return 'Timeout'
    case 'RATE_LIMIT': return 'Límite de peticiones'
    case 'FORBIDDEN': return 'Sin permisos'
    case 'NOT_FOUND': return 'No encontrado'
    case 'SERVICE_UNAVAILABLE':
    case 'BAD_GATEWAY':
    case 'GATEWAY_TIMEOUT': return 'Servicio no disponible'
    case 'VALIDATION':
    case 'BAD_REQUEST': return 'Datos inválidos'
    case 'CONFLICT': return 'Conflicto'
    default: return 'Error del servidor'
  }
}

// ── API client (unchanged interface) ────────────────────────────────
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
