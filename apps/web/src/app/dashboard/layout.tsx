import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { CommandPalette } from '@/components/command-palette'
import { OnboardingTour } from '@/components/onboarding-tour'
import { ConnectionBanner } from '@/components/connection-banner'
import { ShortcutsHelp } from '@/components/shortcuts-help'
import { PageTransition } from '@/components/page-transition'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar session={session} />
        <ConnectionBanner />
        <main id="main-content" className="flex-1 overflow-y-auto p-3 md:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <div data-print-hide><CommandPalette /></div>
      <div data-print-hide><OnboardingTour /></div>
      <div data-print-hide><ShortcutsHelp /></div>
    </div>
  )
}
