import { act, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useVoiceStore } from '@/features/voice'
import { api } from '@/lib/api/client'
import { useVoiceSession } from '@/stores/voice-session'
import { failOnConsoleError } from '@/test/console-guard'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { meQueryOptions } from './api'

failOnConsoleError()

// Route-level session behaviour: the _app guard, /sign-in, and the auth_error param.
// (Kept out of src/routes so the router plugin doesn't treat the test as a route file.)

function signedOut() {
  server.use(
    http.get('*/api/auth/me', () =>
      HttpResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } },
        { status: 401 },
      ),
    ),
  )
}

/**
 * renderRoute, plus letting mount-time async work (the auth_error strip navigation, the session
 * refresh it triggers) settle inside act, so React doesn't warn about unwrapped updates.
 */
async function renderRouteSettled(path: string) {
  let rendered: Awaited<ReturnType<typeof renderRoute>> | undefined
  await act(async () => {
    rendered = await renderRoute(path)
  })
  if (!rendered) throw new Error('renderRoute did not resolve')
  return rendered
}

const RATE_LIMITED_MESSAGE = 'Too many sign-in attempts. Wait a minute and try again.'

describe('auth routes', () => {
  it('sends a signed-out visitor from / to /sign-in with the Steam sign-in link', async () => {
    signedOut()

    const { router } = await renderRoute('/')

    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('carries a failed sign-in to /sign-in, explains it, and strips auth_error from the URL', async () => {
    signedOut()

    const { router } = await renderRouteSettled('/?auth_error=RATE_LIMITED')

    expect(router.state.location.pathname).toBe('/sign-in')
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('auth_error'))
    // The message outlives the one-shot param, so a reload won't show it again but it stays now.
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Couldn't sign you in")
    expect(alert).toHaveTextContent(RATE_LIMITED_MESSAGE)
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
  })

  it('shows the generic message for an auth_error code it does not know', async () => {
    signedOut()

    await renderRouteSettled('/sign-in?auth_error=NEW_CODE')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Sign-in didn't work. Please try again.",
    )
  })

  it('ignores a junk auth_error value instead of showing an error', async () => {
    signedOut()

    const { router } = await renderRoute('/?auth_error=%3Cscript%3E')

    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('toasts a failed sign-in once for a signed-in user, strips the URL and stays on Home', async () => {
    const { router } = await renderRouteSettled('/?auth_error=STEAM_UNAVAILABLE')

    const message = "Steam isn't responding right now. Try again in a moment."
    expect(await screen.findByText(message)).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('auth_error'))
    expect(screen.getAllByText(message)).toHaveLength(1)
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('toasts exactly once under StrictMode', async () => {
    let rendered: Awaited<ReturnType<typeof renderRoute>> | undefined
    await act(async () => {
      rendered = await renderRoute('/?auth_error=RATE_LIMITED', { strict: true })
    })

    expect(await screen.findByText(RATE_LIMITED_MESSAGE)).toBeInTheDocument()
    await waitFor(() =>
      expect(rendered?.router.state.location.search).not.toHaveProperty('auth_error'),
    )
    expect(screen.getAllByText(RATE_LIMITED_MESSAGE)).toHaveLength(1)
  })

  it('sends a signed-in user away from /sign-in to Home', async () => {
    const { router } = await renderRoute('/sign-in')

    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
  })

  it('still shows the sign-in screen when the session check fails with a server error', async () => {
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Something broke.' } },
          { status: 500 },
        ),
      ),
    )

    const { router } = await renderRoute('/sign-in')

    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
  })

  it('still shows the sign-in screen when the API is unreachable', async () => {
    server.use(http.get('*/api/auth/me', () => HttpResponse.error()))

    const { router } = await renderRoute('/sign-in')

    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
  })
})

describe('session ending inside the app', () => {
  it('goes to /sign-in when another API call returns 401', async () => {
    const { router, queryClient } = await renderRoute('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    // Signed-in state that must not survive the session.
    queryClient.setQueryData(['rooms'], [{ id: 'night-owls' }])
    act(() => {
      useVoiceStore.getState().toggleMute()
      useVoiceSession.getState().join('night-owls', 'voice-token')
    })

    signedOut()
    server.use(
      http.get('*/api/rooms', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } },
          { status: 401 },
        ),
      ),
    )
    // Any feature's request going through the shared client, e.g. loading the room list.
    await act(async () => {
      await api.GET('/api/rooms')
    })

    expect(await screen.findByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sign-in')
    await waitFor(() => expect(queryClient.getQueryData(['rooms'])).toBeUndefined())
    expect(queryClient.getQueryData(meQueryOptions.queryKey)).toBeNull()
    expect(useVoiceStore.getState().muted).toBe(false)
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', token: null })
  })

  it('goes to /sign-in when a background session refetch finds the user signed out', async () => {
    const { router, queryClient } = await renderRoute('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()

    signedOut()
    // What a window-focus refetch does once the cookie has expired.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: meQueryOptions.queryKey })
    })

    expect(await screen.findByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sign-in')
  })
})
