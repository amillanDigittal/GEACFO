'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters = { ...defaults } as T
  for (const key of Object.keys(defaults)) {
    const val = searchParams.get(key)
    if (val !== null) (filters as any)[key] = val
  }

  const setFilters = useCallback((updates: Partial<T>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '' || value === defaults[key as keyof T]) {
        params.delete(key)
      } else {
        params.set(key, value as string)
      }
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, router, pathname, defaults])

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  return { filters, setFilters, clearFilters }
}
