import { http, HttpResponse, type RequestHandler } from 'msw'
import { meFixture } from '../fixtures/me'

/** Default handlers shared by all tests. Override per test with `server.use(...)`. */
export const handlers: RequestHandler[] = [
  // Signed in by default, so route tests render the app shell.
  http.get('*/api/auth/me', () => HttpResponse.json(meFixture)),
]
