import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

// No failOnConsoleError here: React 18 logs every error an error boundary catches ("The above
// error occurred in the <errorComponent> component"), which is exactly what these tests trigger.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('AppErrorScreen', () => {
  it('explains an unreachable API and recovers with Try again', async () => {
    server.use(http.get('*/api/auth/me', () => HttpResponse.error()))
    const user = userEvent.setup()

    const { router } = await renderRoute('/')

    expect(await screen.findByRole('heading', { name: "Couldn't reach Hideout" })).toBeInTheDocument()
    expect(screen.getByText('Check your connection and try again.')).toBeInTheDocument()

    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('keeps the generic copy for server errors', async () => {
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'Broke.' } }, { status: 500 }),
      ),
    )

    await renderRoute('/')

    expect(await screen.findByText("This page didn't load")).toBeInTheDocument()
    expect(screen.queryByText("Couldn't reach Hideout")).not.toBeInTheDocument()
  })
})
