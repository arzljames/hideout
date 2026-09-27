import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { registerSessionExpiry } from '@/features/auth'
import { queryClient } from '@/lib/query-client'
import { routeTree } from './routeTree.gen'
import './index.css'

function createAppRouter() {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // Let TanStack Query own caching; the router just triggers loaders.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

const root = createRoot(document.getElementById('root')!)

const router = createAppRouter()
// A 401 from any endpoint means the session ended: tear it down and go to /sign-in.
registerSessionExpiry(queryClient, router)

root.render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
