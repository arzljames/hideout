import { http, HttpResponse, type RequestHandler } from 'msw'
import type { CreateRoomBody, RoomDetail, UpdateRoomBody } from '@/features/rooms'
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

/** Default room endpoints, backed by the fixtures (writes don't change them). */
export const roomHandlers: RequestHandler[] = [
  roomsListHandler(),
  roomDetailHandler(),
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
