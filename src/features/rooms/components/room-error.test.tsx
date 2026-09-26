import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

// No failOnConsoleError here: React 18 logs every error an error boundary catches, which is
// exactly what these tests trigger.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('RoomError', () => {
  it('explains an unreachable API and recovers with Try again', async () => {
    server.use(http.get('*/api/rooms/:roomId', () => HttpResponse.error()))
    const user = userEvent.setup()

    await renderRoute(roomPath(nightOwls, 'general'))

    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      "Couldn't reach Hideout. Check your connection and try again.",
    )

    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'general' })).toBeInTheDocument()
  })
})
