import { http, HttpResponse, type RequestHandler } from 'msw'
import { meFixture } from '../fixtures/me'
import { testRealtimeToken } from '../fixtures/realtime-token'
import { inviteHandlers } from './invites'
import { messageHandlers } from './messages'
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
  // An empty inbox and no active invites; override per test for invite flows.
  ...inviteHandlers,
  // Empty text channels; sends, edits and deletes succeed without changing them. For history
  // or stateful writes, `server.use(...messageHandlers({ [channelId]: messages }))`.
  ...messageHandlers({}, { persist: false }),
]
