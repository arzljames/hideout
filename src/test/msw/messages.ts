import { http, HttpResponse, type RequestHandler } from 'msw'
import type { EditMessageBody, Message, SendMessageBody } from '@/features/messages'
import { meFixture } from '../fixtures/me'
import { roomFixtures } from '../fixtures/rooms'

function errorBody(code: string, message: string) {
  return { error: { code, message } }
}

const channelNotFound = () =>
  HttpResponse.json(errorBody('NOT_FOUND', 'Channel not found.'), { status: 404 })
const messageNotFound = () =>
  HttpResponse.json(errorBody('NOT_FOUND', 'Message not found.'), { status: 404 })
const notText = () =>
  HttpResponse.json(errorBody('CHANNEL_NOT_TEXT', 'This is a voice channel.'), { status: 409 })

function findChannel(channelId: unknown) {
  for (const detail of roomFixtures) {
    const channel = detail.channels.find((item) => item.id === channelId)
    if (channel) return channel
  }
  return null
}

let sent = 0

/** A message as `POST /api/channels/:channelId/messages` returns it, by the signed-in user. */
export function sentMessage(channelId: string, body: string): Message {
  sent += 1
  return {
    id: `f1000000-0000-4000-8000-${String(sent).padStart(12, '0')}`,
    channelId,
    author: { id: meFixture.id, displayName: meFixture.displayName, avatarUrl: meFixture.avatarUrl },
    body: body.replace(/\r\n/g, '\n'),
    createdAt: new Date().toISOString(),
    editedAt: null,
  }
}

interface MessageHandlerOptions {
  /** Largest page served (the API's default is 50). */
  pageSize?: number
  /** False: writes succeed but don't change the store (the shared default handlers). */
  persist?: boolean
}

/**
 * Message endpoints for the fixture rooms, backed by `messages` (per channel id, oldest first).
 * The store is this call's own copy, so writes (send, edit, delete) change what later reads
 * return. History is served newest first with an offset cursor; `after` backfills oldest first.
 * A repeated Idempotency-Key replays the original message (200 + `Idempotent-Replayed`).
 * Unknown channels and messages get 404, voice channels 409 CHANNEL_NOT_TEXT.
 */
export function messageHandlers(
  messages: Record<string, Message[]> = {},
  { pageSize = 50, persist = true }: MessageHandlerOptions = {},
): RequestHandler[] {
  const store = new Map(Object.entries(messages).map(([id, items]) => [id, [...items]]))
  const byKey = new Map<string, Message>()
  const listOf = (channelId: string) => {
    let items = store.get(channelId)
    if (!items) {
      items = []
      store.set(channelId, items)
    }
    return items
  }
  const findMessage = (messageId: unknown) => {
    for (const items of store.values()) {
      const index = items.findIndex((item) => item.id === messageId)
      if (index !== -1) return { items, index }
    }
    return null
  }

  return [
    http.get('*/api/channels/:channelId/messages', ({ params, request }) => {
      const channel = findChannel(params.channelId)
      if (!channel) return channelNotFound()
      if (channel.type !== 'text') return notText()
      const url = new URL(request.url)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? pageSize), pageSize)
      const items = listOf(channel.id)
      const after = url.searchParams.get('after')
      if (after) {
        const index = items.findIndex((item) => item.id === after)
        return HttpResponse.json({ data: items.slice(index + 1, index + 1 + limit), nextCursor: null })
      }
      const offset = Number(url.searchParams.get('cursor') ?? 0)
      const newestFirst = [...items].reverse()
      const data = newestFirst.slice(offset, offset + limit)
      const nextCursor = offset + limit < newestFirst.length ? String(offset + limit) : null
      return HttpResponse.json({ data, nextCursor })
    }),
    http.post('*/api/channels/:channelId/messages', async ({ params, request }) => {
      const channel = findChannel(params.channelId)
      if (!channel) return channelNotFound()
      if (channel.type !== 'text') return notText()
      const { body } = (await request.json()) as SendMessageBody
      const key = request.headers.get('Idempotency-Key')
      const replay = key ? byKey.get(key) : undefined
      if (replay) {
        return HttpResponse.json(replay, { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
      }
      const message = sentMessage(channel.id, body)
      if (persist) {
        listOf(channel.id).push(message)
        if (key) byKey.set(key, message)
      }
      return HttpResponse.json(message, { status: 201 })
    }),
    http.patch('*/api/messages/:messageId', async ({ params, request }) => {
      const found = findMessage(params.messageId)
      const current = found?.items[found.index]
      if (!found || !current) return messageNotFound()
      const { body } = (await request.json()) as EditMessageBody
      const edited = { ...current, body, editedAt: new Date().toISOString() }
      if (persist) found.items[found.index] = edited
      return HttpResponse.json(edited)
    }),
    http.delete('*/api/messages/:messageId', ({ params }) => {
      const found = findMessage(params.messageId)
      if (!found) return messageNotFound()
      if (persist) found.items.splice(found.index, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
