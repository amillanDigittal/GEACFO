import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CockpitLayout {
  /** KPI keys in display order. null = use default order */
  order: string[] | null
  /** KPI keys that are hidden */
  hidden: string[]
  /** Section keys in display order. null = use default order */
  sectionOrder: string[] | null
}

export type CompareMode = 'mom' | 'yoy'

interface AppState {
  _hydrated: boolean
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  favorites: string[]
  addFavorite: (href: string) => void
  removeFavorite: (href: string) => void
  toggleFavorite: (href: string) => void
  cockpitLayout: CockpitLayout
  setCockpitOrder: (order: string[]) => void
  setCockpitSectionOrder: (order: string[]) => void
  toggleCockpitKpi: (key: string) => void
  resetCockpitLayout: () => void
  compareMode: CompareMode
  setCompareMode: (mode: CompareMode) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      _hydrated: false,
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      favorites: [],
      addFavorite: (href) => set((s) => ({ favorites: s.favorites.includes(href) ? s.favorites : [...s.favorites, href] })),
      removeFavorite: (href) => set((s) => ({ favorites: s.favorites.filter(f => f !== href) })),
      toggleFavorite: (href) => {
        const { favorites } = get()
        if (favorites.includes(href)) set({ favorites: favorites.filter(f => f !== href) })
        else set({ favorites: [...favorites, href] })
      },
      cockpitLayout: { order: null, hidden: [], sectionOrder: null },
      setCockpitOrder: (order) => set((s) => ({ cockpitLayout: { ...s.cockpitLayout, order } })),
      setCockpitSectionOrder: (order) => set((s) => ({ cockpitLayout: { ...s.cockpitLayout, sectionOrder: order } })),
      toggleCockpitKpi: (key) => set((s) => {
        const hidden = s.cockpitLayout.hidden.includes(key)
          ? s.cockpitLayout.hidden.filter(k => k !== key)
          : [...s.cockpitLayout.hidden, key]
        return { cockpitLayout: { ...s.cockpitLayout, hidden } }
      }),
      resetCockpitLayout: () => set({ cockpitLayout: { order: null, hidden: [], sectionOrder: null } }),
      compareMode: 'mom' as CompareMode,
      setCompareMode: (mode) => set({ compareMode: mode }),
    }),
    {
      name: 'geacfo-app',
      onRehydrateStorage: () => () => {
        useAppStore.setState({ _hydrated: true })
      },
    }
  )
)
