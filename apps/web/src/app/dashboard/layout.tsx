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
import { ScrollProgress } from '@/components/scroll-progress'
import { ScrollElevation } from '@/components/scroll-elevation'
import { MobileNav } from '@/components/layout/mobile-nav'
import { DynamicFavicon } from '@/components/dynamic-favicon'
import { FooterBar } from '@/components/layout/footer-bar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-[300] focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:text-sm focus-visible:font-semibold focus-visible:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <ConnectionBanner />
        <main id="main-content" className="flex-1 overflow-y-auto relative">
          {/* Decorative gradient mesh — gives glassmorphism cards something to blur */}
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-primary/[0.07] blur-[150px]" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-[hsl(var(--gold)/0.05)] blur-[120px]" />
          </div>
          <Topbar session={session} />
          <ScrollProgress />
          <ScrollElevation />
          <div className="relative z-[1] p-3 md:p-6 pb-20 md:pb-6">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
        <FooterBar />
      </div>
      <div data-print-hide><CommandPalette /></div>
      <div data-print-hide><OnboardingTour /></div>
      <div data-print-hide><ShortcutsHelp /></div>
      <MobileNav />
      <DynamicFavicon />
    </div>
  )
}
