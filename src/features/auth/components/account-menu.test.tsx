import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { http, HttpResponse } from 'msw'
import { useVoiceStore } from '@/features/voice'
import { useVoiceSession } from '@/stores/voice-session'
import { failOnConsoleError } from '@/test/console-guard'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const SIGN_OUT_FAILED = "Couldn't sign you out. Check your connection and try again."

type LogoutPath = '/api/auth/logout' | '/api/auth/logout-all'

/** Record every POST to a logout endpoint and answer with `status`. */
function respondToLogout(path: LogoutPath, status: number) {
  const requests: Request[] = []
  server.use(
    http.post(`*${path}`, ({ request }) => {
      requests.push(request.clone())
      if (status === 204) {
        // Once signed out, the session check comes back 401.
        server.use(http.get('*/api/auth/me', () => new HttpResponse(null, { status: 401 })))
        return new HttpResponse(null, { status: 204 })
      }
      return HttpResponse.json(
        { error: { code: status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL', message: 'Nope.' } },
        { status },
      )
    }),
  )
  return requests
}

/** Fail the test if a logout endpoint is called at all. */
function forbidLogoutRequests() {
  const requests: string[] = []
  server.use(
    http.post('*/api/auth/logout', ({ request }) => {
      requests.push(request.url)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post('*/api/auth/logout-all', ({ request }) => {
      requests.push(request.url)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return requests
}

async function openAccountMenu() {
  const user = userEvent.setup()
  const rendered = await renderRoute('/')
  const trigger = screen.getByRole('button', { name: 'Arzl, account menu' })
  await user.click(trigger)
  const menu = await screen.findByRole('menu')
  return { user, trigger, menu, ...rendered }
}

async function openSignOutEverywhere() {
  const opened = await openAccountMenu()
  await opened.user.click(within(opened.menu).getByRole('menuitem', { name: 'Sign out everywhere' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Sign out everywhere?' })
  return { ...opened, dialog }
}

describe('AccountMenu', () => {
  it('offers Sign out and Sign out everywhere', async () => {
    const { menu } = await openAccountMenu()

    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Sign out everywhere' })).toBeInTheDocument()
  })

  describe('Sign out', () => {
    it('posts to /api/auth/logout as JSON and ends on the sign-in screen', async () => {
      const requests = respondToLogout('/api/auth/logout', 204)
      const { user, menu, router } = await openAccountMenu()

      await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))

      expect(await screen.findByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/sign-in')
      expect(requests).toHaveLength(1)
      expect(requests[0]?.headers.get('Content-Type')).toBe('application/json')
      expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument()
    })

    it('clears cached data and voice state on the way out', async () => {
      respondToLogout('/api/auth/logout', 204)
      const { user, menu, queryClient } = await openAccountMenu()
      queryClient.setQueryData(['rooms'], [{ id: 'night-owls' }])
      act(() => {
        useVoiceStore.getState().toggleMute()
        useVoiceSession.getState().join('night-owls', 'voice-token')
      })

      await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))

      expect(await screen.findByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
      await waitFor(() => expect(queryClient.getQueryData(['rooms'])).toBeUndefined())
      expect(queryClient.getQueryData(['auth', 'me'])).toBeNull()
      expect(useVoiceStore.getState().muted).toBe(false)
      expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', token: null })
    })

    it('still ends on the sign-in screen when the session had already expired (401)', async () => {
      respondToLogout('/api/auth/logout', 401)
      const { user, menu, router } = await openAccountMenu()

      await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))

      expect(await screen.findByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/sign-in')
      expect(screen.queryByText(SIGN_OUT_FAILED)).not.toBeInTheDocument()
    })

    it('shows an error toast and stays in the app when the API fails', async () => {
      respondToLogout('/api/auth/logout', 500)
      const { user, menu, router } = await openAccountMenu()

      await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))

      expect(await screen.findByText(SIGN_OUT_FAILED)).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
      // The menu stays open (so the retry is one click away); closing it shows Home again.
      expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).not.toHaveAttribute(
        'aria-disabled',
      )
      await user.keyboard('{Escape}')
      expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    })

    it('shows the same error toast when the API is unreachable', async () => {
      server.use(http.post('*/api/auth/logout', () => HttpResponse.error()))
      const { user, menu, router } = await openAccountMenu()

      await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))

      expect(await screen.findByText(SIGN_OUT_FAILED)).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
    })

    it('disables both sign-out actions while the request is in flight', async () => {
      let release: () => void = () => {}
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      server.use(
        http.post('*/api/auth/logout', async () => {
          await released
          return HttpResponse.json(
            { error: { code: 'INTERNAL', message: 'Nope.' } },
            { status: 500 },
          )
        }),
      )
      const { user, menu } = await openAccountMenu()

      await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))

      await waitFor(() =>
        expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute(
          'aria-disabled',
          'true',
        ),
      )
      expect(within(menu).getByRole('menuitem', { name: 'Sign out everywhere' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )

      release()

      expect(await screen.findByText(SIGN_OUT_FAILED)).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).not.toHaveAttribute(
        'aria-disabled',
      )
    })
  })

  describe('Sign out everywhere', () => {
    it('asks for confirmation before signing out every device', async () => {
      const requests = forbidLogoutRequests()
      const { dialog } = await openSignOutEverywhere()

      expect(dialog).toHaveAccessibleDescription(
        'This signs you out of Hideout on every device, including this one.',
      )
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument()
      expect(requests).toEqual([])
    })

    it('closes on Cancel, returns focus to the account menu button and sends nothing', async () => {
      const requests = forbidLogoutRequests()
      const { user, dialog, trigger, router } = await openSignOutEverywhere()

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(trigger).toHaveFocus()
      expect(requests).toEqual([])
      expect(router.state.location.pathname).toBe('/')
    })

    it('closes on Escape and returns focus to the account menu button', async () => {
      forbidLogoutRequests()
      const { user, trigger } = await openSignOutEverywhere()

      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(trigger).toHaveFocus()
    })

    it('posts to /api/auth/logout-all as JSON on confirm and ends on the sign-in screen', async () => {
      const requests = respondToLogout('/api/auth/logout-all', 204)
      const { user, dialog, router } = await openSignOutEverywhere()

      await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }))

      expect(await screen.findByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/sign-in')
      expect(requests).toHaveLength(1)
      expect(requests[0]?.headers.get('Content-Type')).toBe('application/json')
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('still ends on the sign-in screen when the session had already expired (401)', async () => {
      respondToLogout('/api/auth/logout-all', 401)
      const { user, dialog, router } = await openSignOutEverywhere()

      await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }))

      expect(await screen.findByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/sign-in')
    })

    it('keeps the dialog open with an error toast when the API fails', async () => {
      respondToLogout('/api/auth/logout-all', 500)
      const { user, dialog, router } = await openSignOutEverywhere()

      await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }))

      expect(await screen.findByText(SIGN_OUT_FAILED)).toBeInTheDocument()
      expect(screen.getByRole('alertdialog', { name: 'Sign out everywhere?' })).toBeInTheDocument()
      // Settled, so the user can retry or cancel.
      expect(within(dialog).getByRole('button', { name: 'Sign out everywhere' })).toBeEnabled()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled()
      expect(router.state.location.pathname).toBe('/')
    })
  })
})
