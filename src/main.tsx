import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import {
  completeSteamSignInPopup,
  registerSessionExpiry,
  SteamPopupDoneScreen,
} from '@/features/auth'
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

// If this window is the Steam sign-in popup coming back, report to the app and close, without
// booting the router. The screen below only shows if the browser refused to close the window.
const steamPopup = completeSteamSignInPopup()

if (steamPopup) {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <SteamPopupDoneScreen authError={steamPopup.authError} />
      </ThemeProvider>
    </StrictMode>,
  )
} else {
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
}
