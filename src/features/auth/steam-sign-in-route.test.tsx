import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const NONCE = '1111-2222-3333-4444-5555'
const WAITING = 'Finish signing in in the Steam tab.'

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

/** What the popup's completeSteamSignInPopup() sends from its own window. */
function broadcastFromPopup(message: Record<string, unknown>) {
  const channel = new BroadcastChannel('hideout-auth')
  channel.postMessage({ type: 'steam-sign-in', ...message })
  channel.close()
}

async function openPopupFromSignIn() {
  signedOut()
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(NONCE)
  // Only the fields openSteamSignIn touches.
  const popup = { focus: vi.fn(), opener: window, location: { href: '' } } as unknown as Window
  const open = vi.spyOn(window, 'open').mockReturnValue(popup)
  const user = userEvent.setup()
  const rendered = await renderRoute('/sign-in')

  await user.click(screen.getByRole('button', { name: 'Sign in with Steam' }))

  expect(open).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status')).toHaveTextContent(WAITING)
  return rendered
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Steam sign-in tab on /sign-in', () => {
  it('goes Home when the popup reports success and the session is confirmed', async () => {
    const { router } = await openPopupFromSignIn()

    server.resetHandlers() // /api/auth/me is 200 again: the popup set the session cookie.
    act(() => broadcastFromPopup({ nonce: NONCE }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows the error from the popup and stays on /sign-in', async () => {
    const { router } = await openPopupFromSignIn()

    act(() => broadcastFromPopup({ nonce: NONCE, authError: 'RATE_LIMITED' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't sign you in")
    expect(alert).toHaveTextContent('Too many sign-in attempts. Wait a minute and try again.')
    await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeEnabled()
  })

  it("ignores another tab's error but still picks up its successful sign-in", async () => {
    const { router } = await openPopupFromSignIn()

    act(() => broadcastFromPopup({ nonce: 'someone-else', authError: 'RATE_LIMITED' }))
    // Give the message a chance to arrive; nothing should change.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(WAITING)

    server.resetHandlers()
    act(() => broadcastFromPopup({ nonce: 'someone-else' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('checks the session when the window regains focus and goes Home if signed in', async () => {
    signedOut()
    const { router } = await renderRoute('/sign-in')

    server.resetHandlers()
    fireEvent.focus(window)

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('goes Home when the Steam tab lost its nonce and another tab announces signed-in', async () => {
    signedOut()
    const { router } = await renderRoute('/sign-in')

    server.resetHandlers()
    act(() => {
      const channel = new BroadcastChannel('hideout-auth')
      channel.postMessage({ type: 'signed-in' })
      channel.close()
    })

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('picks up the announcement from a localStorage storage event', async () => {
    const { router } = await openPopupFromSignIn()

    server.resetHandlers()
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'hideout:auth-signal',
          newValue: JSON.stringify({ type: 'steam-sign-in', nonce: NONCE, at: 1 }),
        }),
      )
    })

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('checks the session when the tab becomes visible again', async () => {
    signedOut()
    const { router } = await renderRoute('/sign-in')

    server.resetHandlers()
    fireEvent(document, new Event('visibilitychange'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('stays on /sign-in when focus finds no session', async () => {
    signedOut()
    const { router, queryClient } = await renderRoute('/sign-in')
    const refetch = vi.spyOn(queryClient, 'refetchQueries')

    fireEvent.focus(window)

    await waitFor(() => expect(refetch).toHaveBeenCalled())
    await act(async () => {
      await refetch.mock.results[0]?.value
    })
    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
  })
})
