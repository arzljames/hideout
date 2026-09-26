import { http, HttpResponse, type RequestHandler } from 'msw'
import type {
  Channel,
  CreateChannelBody,
  CreateRoomBody,
  RenameChannelBody,
  ReorderChannelsBody,
  RoomDetail,
  UpdateRoomBody,
} from '@/features/rooms'
import { meFixture } from '../fixtures/me'
import { roomFixtures, toMyRoom } from '../fixtures/rooms'

function errorBody(code: string, message: string) {
  return { error: { code, message } }
}

export const roomNotFound = () =>
  HttpResponse.json(errorBody('NOT_FOUND', 'Room not found.'), { status: 404 })

/** `GET /api/rooms` serving `rooms` in one page. */
export function roomsListHandler(rooms: RoomDetail[] = roomFixtures): RequestHandler {
  return http.get('*/api/rooms', () =>
    HttpResponse.json({ data: rooms.map(toMyRoom), nextCursor: null }),
  )
}

/** `GET /api/rooms/:roomId` serving `rooms`, 404 for any other id. */
export function roomDetailHandler(rooms: RoomDetail[] = roomFixtures): RequestHandler {
  return http.get('*/api/rooms/:roomId', ({ params }) => {
    const detail = rooms.find((item) => item.room.id === params.roomId)
    return detail ? HttpResponse.json(detail) : roomNotFound()
  })
}

let created = 0

/** A new room as `POST /api/rooms` returns it: the caller owns it, with #general and voice. */
export function createdRoom(body: CreateRoomBody): RoomDetail {
  created += 1
  const suffix = String(created).padStart(12, '0')
  const id = `b0000000-0000-4000-8000-${suffix}`
  const general = { id: `d0000000-0000-4000-8000-${suffix}`, roomId: id, type: 'text' as const, name: 'general', position: 0 }
  const voice = { id: `d1000000-0000-4000-8000-${suffix}`, roomId: id, type: 'voice' as const, name: 'voice', position: 0 }
  return {
    room: { id, name: body.name.trim(), icon: body.icon, createdAt: new Date().toISOString() },
    myRole: 'owner',
    defaultChannelId: general.id,
    channels: [general, voice],
    members: [
      {
        roomId: id,
        user: { id: meFixture.id, displayName: meFixture.displayName, avatarUrl: meFixture.avatarUrl },
        role: 'owner',
        joinedAt: new Date().toISOString(),
        currentGame: null,
      },
    ],
  }
}

export const channelNotFound = () =>
  HttpResponse.json(errorBody('NOT_FOUND', 'Channel not found.'), { status: 404 })

/** The room (among `rooms`) holding a channel, and that channel. */
function findChannel(rooms: RoomDetail[], channelId: unknown) {
  for (const detail of rooms) {
    const channel = detail.channels.find((item) => item.id === channelId)
    if (channel) return { detail, channel }
  }
  return null
}

let createdChannels = 0

/** A new channel as `POST /api/rooms/:roomId/channels` returns it: last of its type. */
export function createdChannel(detail: RoomDetail, body: CreateChannelBody): Channel {
  createdChannels += 1
  const ofType = detail.channels.filter((channel) => channel.type === body.type)
  return {
    id: `d2000000-0000-4000-8000-${String(createdChannels).padStart(12, '0')}`,
    roomId: detail.room.id,
    type: body.type,
    name: body.name.trim().normalize('NFC'),
    position: ofType.reduce((max, channel) => Math.max(max, channel.position + 1), 0),
  }
}

/**
 * Channel endpoints backed by `rooms` (writes don't change them): create, rename, reorder
 * (409 CHANNEL_ORDER_STALE unless every channel of the type is listed once) and delete (409
 * LAST_TEXT_CHANNEL for a room's only text channel). Unknown rooms and channels get 404.
 */
export function channelHandlers(rooms: RoomDetail[] = roomFixtures): RequestHandler[] {
  const roomById = (roomId: unknown) => rooms.find((item) => item.room.id === roomId)
  return [
    http.post('*/api/rooms/:roomId/channels', async ({ params, request }) => {
      const detail = roomById(params.roomId)
      if (!detail) return roomNotFound()
      const body = (await request.json()) as CreateChannelBody
      return HttpResponse.json(createdChannel(detail, body), { status: 201 })
    }),
    http.patch('*/api/channels/:channelId', async ({ params, request }) => {
      const found = findChannel(rooms, params.channelId)
      if (!found) return channelNotFound()
      const body = (await request.json()) as RenameChannelBody
      return HttpResponse.json({ ...found.channel, name: body.name.trim().normalize('NFC') })
    }),
    http.put('*/api/rooms/:roomId/channels/order', async ({ params, request }) => {
      const detail = roomById(params.roomId)
      if (!detail) return roomNotFound()
      const body = (await request.json()) as ReorderChannelsBody
      const ofType = detail.channels.filter((channel) => channel.type === body.type)
      const ordered = body.channelIds.map((id) => ofType.find((channel) => channel.id === id))
      const complete =
        body.channelIds.length === ofType.length &&
        new Set(body.channelIds).size === body.channelIds.length &&
        ordered.every((channel) => channel !== undefined)
      if (!complete) {
        return HttpResponse.json(
          errorBody('CHANNEL_ORDER_STALE', 'The channel list is out of date.'),
          { status: 409 },
        )
      }
      return HttpResponse.json({
        data: ordered.flatMap((channel, position) => (channel ? [{ ...channel, position }] : [])),
      })
    }),
    http.delete('*/api/channels/:channelId', ({ params }) => {
      const found = findChannel(rooms, params.channelId)
      if (!found) return channelNotFound()
      const textChannels = found.detail.channels.filter((channel) => channel.type === 'text')
      if (found.channel.type === 'text' && textChannels.length <= 1) {
        return HttpResponse.json(
          errorBody('LAST_TEXT_CHANNEL', 'A room needs at least one text channel.'),
          { status: 409 },
        )
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

/** Default room endpoints, backed by the fixtures (writes don't change them). */
export const roomHandlers: RequestHandler[] = [
  roomsListHandler(),
  roomDetailHandler(),
  ...channelHandlers(),
  http.post('*/api/rooms', async ({ request }) => {
    const body = (await request.json()) as CreateRoomBody
    return HttpResponse.json(createdRoom(body), { status: 201 })
  }),
  http.patch('*/api/rooms/:roomId', async ({ params, request }) => {
    const detail = roomFixtures.find((item) => item.room.id === params.roomId)
    if (!detail) return roomNotFound()
    const body = (await request.json()) as UpdateRoomBody
    const room = {
      ...detail.room,
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.icon !== undefined && { icon: body.icon }),
    }
    return HttpResponse.json({ ...detail, room })
  }),
  http.delete('*/api/rooms/:roomId', ({ params }) => {
    const detail = roomFixtures.find((item) => item.room.id === params.roomId)
    return detail ? new HttpResponse(null, { status: 204 }) : roomNotFound()
  }),
]
