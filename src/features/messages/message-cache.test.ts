import { createTestQueryClient } from '@/test/render'
import { makeMessage } from '@/test/fixtures/messages'
import {
  flattenMessages,
  getNewestMessageId,
  isQuietMessage,
  mergeBackfill,
  messageKeys,
  removeMessage,
  upsertMessage,
} from './message-cache'
import type { MessagesData } from './types'

const channelId = 'C0000000-0000-4000-8000-000000000001'

function setup() {
  const queryClient = createTestQueryClient()
  const older = makeMessage({ channelId, createdAt: '2026-09-01T10:00:00.000Z' })
  const newer = makeMessage({ channelId, createdAt: '2026-09-01T11:00:00.000Z' })
  const data: MessagesData = {
    pages: [
      { data: [newer], nextCursor: 'c1' },
      { data: [older], nextCursor: null },
    ],
    pageParams: [undefined, 'c1'],
  }
  queryClient.setQueryData(messageKeys.channel(channelId), data)
  const read = () => queryClient.getQueryData<MessagesData>(messageKeys.channel(channelId))
  return { queryClient, older, newer, read }
}

describe('message cache', () => {
  it('inserts a new message into the newest page, idempotently', () => {
    const { queryClient, read } = setup()
    const message = makeMessage({ channelId, createdAt: '2026-09-01T12:00:00.000Z' })

    upsertMessage(queryClient, channelId, message)
    upsertMessage(queryClient, channelId.toLowerCase(), message)

    expect(read()?.pages[0]?.data.map((item) => item.id)).toEqual([
      message.id,
      read()?.pages[0]?.data[1]?.id,
    ])
    expect(flattenMessages(read())).toHaveLength(3)
  })

  it('replaces a known message in place (ids ignore case)', () => {
    const { queryClient, older, read } = setup()

    upsertMessage(queryClient, channelId, { ...older, id: older.id.toUpperCase(), body: 'edited' })

    expect(read()?.pages[1]?.data).toEqual([{ ...older, id: older.id.toUpperCase(), body: 'edited' }])
    expect(flattenMessages(read())).toHaveLength(2)
  })

  it('removes a message from whichever page holds it', () => {
    const { queryClient, older, read } = setup()

    removeMessage(queryClient, channelId, older.id.toUpperCase())

    expect(read()?.pages[1]?.data).toEqual([])
  })

  it('merges a backfill without duplicates, and marks it quiet', () => {
    const { queryClient, newer, read } = setup()
    const later = makeMessage({ channelId, createdAt: '2026-09-01T12:00:00.000Z' })

    mergeBackfill(queryClient, channelId, [newer, later])

    expect(flattenMessages(read()).map((item) => item.id)).toHaveLength(3)
    expect(getNewestMessageId(queryClient, channelId)).toBe(later.id)
    expect(isQuietMessage(later.id)).toBe(true)
  })

  it('keeps pages newest first when merging an oldest-first backfill, ignoring case-only duplicates', () => {
    const { queryClient, newer, older, read } = setup()
    const a = makeMessage({ channelId, createdAt: '2026-09-01T12:00:00.000Z' })
    const b = makeMessage({ channelId, createdAt: '2026-09-01T12:01:00.000Z' })
    const c = makeMessage({ channelId, createdAt: '2026-09-01T12:02:00.000Z' })

    mergeBackfill(queryClient, channelId, [
      { ...newer, id: newer.id.toUpperCase() },
      a,
      b,
      { ...a, id: a.id.toUpperCase() },
      c,
    ])

    expect(read()?.pages[0]?.data.map((item) => item.id.toLowerCase())).toEqual(
      [c, b, a, newer].map((item) => item.id.toLowerCase()),
    )
    expect(read()?.pages[1]?.data).toEqual([older])
    expect(flattenMessages(read()).map((item) => item.id.toLowerCase())).toEqual(
      [older, newer, a, b, c].map((item) => item.id.toLowerCase()),
    )
  })

  it('leaves the data untouched when an upsert repeats the cached message or removes an unknown id', () => {
    const { queryClient, newer, read } = setup()
    const before = read()

    upsertMessage(queryClient, channelId, newer)
    removeMessage(queryClient, channelId, 'f0000000-0000-4000-8000-999999999999')

    expect(read()).toBe(before)
  })

  it('does nothing while the channel history is not cached', () => {
    const queryClient = createTestQueryClient()
    const message = makeMessage({ channelId })

    upsertMessage(queryClient, channelId, message)
    removeMessage(queryClient, channelId, message.id)
    mergeBackfill(queryClient, channelId, [message])

    expect(queryClient.getQueryData(messageKeys.channel(channelId))).toBeUndefined()
    expect(getNewestMessageId(queryClient, channelId)).toBeUndefined()
  })
})
