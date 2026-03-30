'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

const variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  enter:  { opacity: 1, y: 0, scale: 1 },
  exit:   { opacity: 0, y: -8, scale: 0.98 },
}

/**
 * Wraps dashboard page content with Framer Motion enter/exit transitions.
 * Enter: fade + slide up + subtle scale. Exit: fade + slide up + shrink.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="hidden"
        animate="enter"
        exit="exit"
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
