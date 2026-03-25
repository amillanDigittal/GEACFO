import useSWR, { SWRConfiguration } from 'swr'
import { api } from '@/lib/api'

// Default SWR options for data that changes infrequently
const SLOW: SWRConfiguration = { revalidateOnFocus: false, dedupingInterval: 60_000 }
// Default SWR options for data that should stay fresh
const FRESH: SWRConfiguration = { revalidateOnFocus: true, dedupingInterval: 10_000 }

// ─── Treasury ───────────────────────────────────────────────────────
export function useCockpit() {
  return useSWR('treasury/cockpit', () => api.treasury.cockpit(), FRESH)
}

export function useForecast(scenario?: string) {
  return useSWR(
    scenario ? `treasury/forecast/${scenario}` : 'treasury/forecast',
    () => api.treasury.forecast(scenario),
    FRESH,
  )
}

export function useForecastCompare() {
  return useSWR('treasury/forecast/compare', () => api.treasury.forecastCompare(), SLOW)
}

export function useAccounts() {
  return useSWR('treasury/accounts', () => api.treasury.accounts(), SLOW)
}

export function useReconciliation() {
  return useSWR('treasury/reconciliation', () => api.treasury.reconciliation(), FRESH)
}

export function useAutoMatch() {
  return useSWR('treasury/auto-match', () => api.treasury.autoMatch(), SLOW)
}

export function useRatios() {
  return useSWR('treasury/ratios', () => api.treasury.ratios(), SLOW)
}

export function useAR(from?: string, to?: string) {
  return useSWR(
    `treasury/ar?from=${from || ''}&to=${to || ''}`,
    () => api.treasury.ar(from, to),
    FRESH,
  )
}

export function useAP(from?: string, to?: string) {
  return useSWR(
    `treasury/ap?from=${from || ''}&to=${to || ''}`,
    () => api.treasury.ap(from, to),
    FRESH,
  )
}

// ─── Customers ──────────────────────────────────────────────────────
export function useCustomers() {
  return useSWR('customers', () => api.customers.list(), FRESH)
}

export function useCustomer(id: string | null) {
  return useSWR(id ? `customers/${id}` : null, () => api.customers.get(id!), SLOW)
}

// ─── Debt ───────────────────────────────────────────────────────────
export function useDebtSummary() {
  return useSWR('debt/summary', () => api.debt.summary(), SLOW)
}

export function useAmortization() {
  return useSWR('debt/amortization', () => api.debt.amortization(), SLOW)
}

// ─── Bot ────────────────────────────────────────────────────────────
export function useRecommendations() {
  return useSWR('bot/recommendations', () => api.bot.recommendations(), SLOW)
}

export function useBotHistory(sessionId: string | null) {
  return useSWR(
    sessionId ? `bot/history/${sessionId}` : null,
    () => api.bot.history(sessionId!),
    { revalidateOnFocus: false },
  )
}

export function useBotSessions() {
  return useSWR('bot/sessions', () => api.bot.sessions(), SLOW)
}

// ─── Alerts ─────────────────────────────────────────────────────────
export function useAlertCounts() {
  return useSWR('alerts/counts', () => api.alerts.counts(), FRESH)
}

export function useNotifications() {
  return useSWR('alerts/notifications', () => api.alerts.notifications(), FRESH)
}

export function useResolutions() {
  return useSWR('alerts/resolutions', () => api.alerts.resolutions(), FRESH)
}

export function usePredictive() {
  return useSWR('alerts/predictive', () => api.alerts.predictive(), SLOW)
}

// ─── Users ──────────────────────────────────────────────────────────
export function useUsers() {
  return useSWR('users', () => api.users.list(), FRESH)
}

// ─── Suppliers ──────────────────────────────────────────────────────
export function useSuppliers() {
  return useSWR('suppliers', () => api.suppliers.list(), FRESH)
}

export function useSupplier(id: string | null) {
  return useSWR(id ? `suppliers/${id}` : null, () => api.suppliers.get(id!), SLOW)
}
