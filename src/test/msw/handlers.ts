import { http, HttpResponse, type RequestHandler } from 'msw'
import { meFixture } from '../fixtures/me'
import { testRealtimeToken } from '../fixtures/realtime-token'
import { roomHandlers } from './rooms'

/** Default handlers shared by all tests. Override per test with `server.use(...)`. */
export const handlers: RequestHandler[] = [
  // Signed in by default, so route tests render the app shell.
  http.get('*/api/auth/me', () => HttpResponse.json(meFixture)),
  // Signed-in layouts start Realtime; a token valid for 15 minutes.
  http.get('*/api/auth/realtime-token', () =>
    HttpResponse.json({
      token: testRealtimeToken,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
  ),
  // The fixture rooms (src/test/fixtures/rooms.ts); unknown room ids get 404.
  ...roomHandlers,
]
