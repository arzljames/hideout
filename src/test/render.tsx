import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { routeTree } from '@/routeTree.gen'
import { TestProviders } from './providers'

/** Render a component inside the app-level providers (ThemeProvider), without a router. */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: TestProviders, ...options })
}

/** A QueryClient for one test: no retries, no caching between tests. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
}

/**
 * Render the real route tree at `path` with memory history and a fresh QueryClient.
 * Resolves once the initial navigation (guards, loaders, lazy route chunks) has settled,
 * so the matched screen is on the page when the promise resolves.
 *
 * @example
 *   const { router } = await renderRoute('/rooms/night-owls/general')
 *   expect(router.state.location.pathname).toBe('/rooms/night-owls/general')
 */
export async function renderRoute(path: string, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    defaultPendingMinMs: 0,
  })

  await router.load()

  // Async act: the router keeps settling after the first render (e.g. loading a lazily split
  // notFound/error component), and those updates must land inside act too.
  let result!: RenderResult
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
      { wrapper: TestProviders, ...options },
    )
  })

  return { ...result, router, queryClient }
}
