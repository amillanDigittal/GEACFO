import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  favorites: string[]
  addFavorite: (href: string) => void
  removeFavorite: (href: string) => void
  toggleFavorite: (href: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
    }),
    { name: 'geacfo-app' }
  )
)
