import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { TestProviders } from './providers'

/**
 * Render inside the app's providers (currently ThemeProvider).
 * TODO: add QueryClientProvider (fresh client, retries off) and a memory-history
 * router once screens depend on them.
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: TestProviders, ...options })
}
