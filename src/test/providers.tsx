import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'

interface TestProvidersProps {
  children: ReactNode
}

/** App-level providers for component tests. */
export function TestProviders({ children }: TestProvidersProps) {
  return <ThemeProvider>{children}</ThemeProvider>
}
