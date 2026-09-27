import { http, HttpResponse, type RequestHandler } from 'msw'

/** Default invite endpoints: nothing pending, no active invites. */
export const inviteHandlers: RequestHandler[] = [
  http.get('*/api/me/invites', () => HttpResponse.json({ data: [] })),
  http.get('*/api/rooms/:roomId/invites', () => HttpResponse.json({ data: [], nextCursor: null })),
]

/** An API error response, as hideout-api sends it. */
export function apiError(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status })
}
