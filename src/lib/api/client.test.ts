import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import {
  api,
  ApiError,
  apiUrl,
  setUnauthenticatedHandler,
  toApiError,
  withNetworkErrors,
} from './client'

describe('api client', () => {
  it('sends requests with credentials included so the session cookie goes along', async () => {
    let credentials: RequestCredentials | undefined
    server.use(
      http.get('http://api.test/api/auth/me', ({ request }) => {
        credentials = request.credentials
        return new HttpResponse(null, { status: 401 })
      }),
    )

    await api.GET('/api/auth/me')

    expect(credentials).toBe('include')
  })

  it('prefixes requests with VITE_API_URL', async () => {
    let url: string | undefined
    server.use(
      http.get('*/api/auth/me', ({ request }) => {
        url = request.url
        return new HttpResponse(null, { status: 401 })
      }),
    )

    await api.GET('/api/auth/me')

    expect(url).toBe('http://api.test/api/auth/me')
  })

  it('adds Content-Type: application/json to a bodyless POST (the API CSRF check needs it)', async () => {
    let contentType: string | null = null
    server.use(
      http.post('*/api/auth/logout', ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await api.POST('/api/auth/logout')

    expect(contentType).toBe('application/json')
  })

  it('does not add a Content-Type to GET requests', async () => {
    let contentType: string | null = 'unset'
    server.use(
      http.get('*/api/auth/me', ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return new HttpResponse(null, { status: 401 })
      }),
    )

    await api.GET('/api/auth/me')

    expect(contentType).toBeNull()
  })

  it('calls the unauthenticated handler when another endpoint returns 401', async () => {
    const onUnauthenticated = vi.fn()
    setUnauthenticatedHandler(onUnauthenticated)
    server.use(
      http.get('*/api/rooms', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } },
          { status: 401 },
        ),
      ),
    )

    await api.GET('/api/rooms')

    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
  })

  it('does not call the unauthenticated handler for a 401 from GET /api/auth/me', async () => {
    const onUnauthenticated = vi.fn()
    setUnauthenticatedHandler(onUnauthenticated)
    server.use(http.get('*/api/auth/me', () => new HttpResponse(null, { status: 401 })))

    await api.GET('/api/auth/me')

    expect(onUnauthenticated).not.toHaveBeenCalled()
  })

  it('does not call the unauthenticated handler for non-401 failures', async () => {
    const onUnauthenticated = vi.fn()
    setUnauthenticatedHandler(onUnauthenticated)
    server.use(http.get('*/api/rooms', () => new HttpResponse(null, { status: 403 })))

    await api.GET('/api/rooms')

    expect(onUnauthenticated).not.toHaveBeenCalled()
  })
})

describe('apiUrl', () => {
  it('builds an absolute URL on the API origin for full-page navigations', () => {
    expect(apiUrl('/api/auth/steam')).toBe('http://api.test/api/auth/steam')
  })
})

describe('toApiError', () => {
  it('reads status, code, message and details from the contract error body', () => {
    const details = [{ path: 'name', message: 'Too long' }]
    const error = toApiError({
      error: { error: { code: 'VALIDATION_FAILED', message: 'Check the form.', details } },
      response: new Response(null, { status: 422 }),
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Check the form.',
      details,
    })
  })

  it('falls back to UNKNOWN for a non-JSON body', () => {
    const error = toApiError({
      error: '<html>Bad Gateway</html>',
      response: new Response(null, { status: 502 }),
    })

    expect(error).toMatchObject({
      status: 502,
      code: 'UNKNOWN',
      message: 'Request failed with status 502',
    })
    expect(error.details).toBeUndefined()
  })

  it.each([
    ['no body', undefined],
    ['null', null],
    ['an unrelated object', { message: 'nope' }],
    ['an error without a code', { error: { message: 'nope' } }],
    ['a non-string code', { error: { code: 42, message: 'nope' } }],
    ['an error that is a string', { error: 'nope' }],
  ])('falls back to UNKNOWN for %s', (_label, body) => {
    const error = toApiError({ error: body, response: new Response(null, { status: 500 }) })

    expect(error).toMatchObject({ status: 500, code: 'UNKNOWN' })
  })

  it('parses an error body returned by the API through the client', async () => {
    server.use(
      http.get('*/api/rooms', () =>
        HttpResponse.json(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again soon.' } },
          { status: 503 },
        ),
      ),
    )

    const result = await api.GET('/api/rooms')

    expect(toApiError(result)).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Try again soon.',
    })
  })
})

describe('withNetworkErrors', () => {
  it('turns a failed fetch into an ApiError with status 0 and code NETWORK', async () => {
    server.use(http.get('*/api/auth/me', () => HttpResponse.error()))

    const call = withNetworkErrors(() => api.GET('/api/auth/me'))

    await expect(call).rejects.toBeInstanceOf(ApiError)
    await expect(call).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK',
      message: "Couldn't reach Hideout.",
    })
  })

  it('keeps the original failure as the cause', async () => {
    const cause = new TypeError('Failed to fetch')

    const error = await withNetworkErrors(() => Promise.reject(cause)).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).cause).toBe(cause)
  })

  it('rethrows aborts untouched so they count as cancellations', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')

    await expect(withNetworkErrors(() => Promise.reject(abort))).rejects.toBe(abort)
  })

  it('passes successful results through', async () => {
    await expect(withNetworkErrors(() => Promise.resolve('ok'))).resolves.toBe('ok')
  })
})
