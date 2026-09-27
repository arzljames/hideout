import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { apiError } from '@/test/msw/invites'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const TOKEN = 'k'.repeat(43)
const INVITE_PATH = `/invite/${TOKEN}`

function servePreview() {
  server.use(
    http.get('*/api/invites/:token/preview', () =>
      HttpResponse.json({
        room: { name: 'Night Owls', icon: { kind: 'emoji', emoji: '🦉' } },
        memberCount: 7,
        invitedBy: { displayName: 'Maya', avatarUrl: null },
        expiresAt: null,
      }),
    ),
  )
}

describe('/invite/$token', () => {
  it('shows the invalid-invite screen for a 404 preview', async () => {
    server.use(
      http.get('*/api/invites/:token/preview', () => apiError(404, 'NOT_FOUND', 'Not found.')),
    )
    await renderRoute(INVITE_PATH)

    expect(
      await screen.findByRole('heading', { level: 1, name: "This invite isn't valid" }),
    ).toBeInTheDocument()
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
  })

  it('signed out: stores the token before Steam sign-in, and Home sends it back here', async () => {
    servePreview()
    server.use(http.get('*/api/auth/me', () => apiError(401, 'UNAUTHENTICATED', 'Sign in.')))
    const popup = { opener: {}, location: { href: '' }, focus: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const user = userEvent.setup()
    const first = await renderRoute(INVITE_PATH)

    expect(screen.getByRole('heading', { level: 1, name: 'Night Owls' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in with Steam to join' }))
    expect(window.sessionStorage.getItem('hideout:pending-invite')).toBe(TOKEN)
    expect(screen.getByRole('status')).toHaveTextContent('Finish signing in in the Steam tab.')
    expect(open).toHaveBeenCalledTimes(1)
    open.mockRestore()
    first.unmount()

    // The same-tab fallback: the API lands the now signed-in user on `/`.
    server.resetHandlers()
    servePreview()
    const { router } = await renderRoute('/')

    expect(router.state.location.pathname).toBe(INVITE_PATH)
    expect(window.sessionStorage.getItem('hideout:pending-invite')).toBeNull()
  })

  it('Join redeems the invite and lands on the room’s default channel', async () => {
    servePreview()
    server.use(
      http.post('*/api/invites/:token/redeem', () =>
        HttpResponse.json({ status: 'joined', room: nightOwls }),
      ),
    )
    const user = userEvent.setup()
    const { router } = await renderRoute(INVITE_PATH)

    await user.click(screen.getByRole('button', { name: 'Join room' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general')))
    await waitFor(() => expect(document.querySelector('meta[name="referrer"]')).toBeNull())
  })

  it('shows why joining failed for a revoked invite', async () => {
    servePreview()
    server.use(
      http.post('*/api/invites/:token/redeem', () =>
        apiError(410, 'INVITE_REVOKED', 'This invite was revoked.'),
      ),
    )
    const user = userEvent.setup()
    await renderRoute(INVITE_PATH)

    await user.click(screen.getByRole('button', { name: 'Join room' }))

    expect(await screen.findByText('This invite was revoked.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join room' })).toBeDisabled()
  })
})
