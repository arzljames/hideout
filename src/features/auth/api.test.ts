import { http, HttpResponse } from 'msw'
import { ApiError } from '@/lib/api/client'
import { meFixture } from '@/test/fixtures/me'
import { server } from '@/test/msw/server'
import { createTestQueryClient } from '@/test/render'
import { meQueryOptions } from './api'

function fetchMe() {
  return createTestQueryClient().fetchQuery(meQueryOptions)
}

describe('meQueryOptions', () => {
  it('resolves to the signed-in user on 200', async () => {
    await expect(fetchMe()).resolves.toEqual(meFixture)
  })

  it('resolves to null on 401 (signed out)', async () => {
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } },
          { status: 401 },
        ),
      ),
    )

    await expect(fetchMe()).resolves.toBeNull()
  })

  it('throws an ApiError with the API code on other failures', async () => {
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Something broke.' } },
          { status: 500 },
        ),
      ),
    )

    const error = await fetchMe().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, code: 'INTERNAL' })
  })

  it('throws a NETWORK ApiError when the API is unreachable', async () => {
    server.use(http.get('*/api/auth/me', () => HttpResponse.error()))

    await expect(fetchMe()).rejects.toMatchObject({ status: 0, code: 'NETWORK' })
  })
})
