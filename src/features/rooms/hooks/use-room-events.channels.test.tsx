import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { useVoiceStore } from '@/features/voice'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeSupabase, type FakeChannel } from '@/test/fake-supabase'
import { nightOwls, pitLane, roomPath } from '@/test/fixtures/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { isReorderingChannels } from '../channel-cache'
import { roomKeys } from '../room-cache'
import type { Channel, RoomDetail } from '../types'

failOnConsoleError()

const ROOM_ID = nightOwls.room.id
const ROOM_TOPIC = `room:${ROOM_ID}`
const NEW_CHANNEL_ID = 'c0000000-0000-4000-8000-000000009999'

function channelNamed(name: string): Channel {
  const channel = nightOwls.channels.find((item) => item.name === name)
  if (!channel) throw new Error(`no channel ${name}`)
  return channel
}

const general = channelNamed('general')
const clips = channelNamed('clips')
const planning = channelNamed('planning')
const voice = channelNamed('voice')

async function openChannel(name: string) {
  const view = await renderRoute(roomPath(nightOwls, name))
  await vi.waitFor(() => expect(fakeSupabase.channelsFor(ROOM_TOPIC)).toHaveLength(1))
  const topic: FakeChannel = fakeSupabase.channelsFor(ROOM_TOPIC)[0]!
  return { ...view, topic }
}

/**
 * Broadcast on the room topic, then let async handlers (e.g. a delete awaiting navigation) and
 * the cache notifications they schedule (a timer away) render.
 */
async function broadcast(topic: FakeChannel, events: [string, unknown][]) {
  await act(async () => {
    for (const [event, payload] of events) topic.emitBroadcast(event, payload)
    for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** The sidebar's channel names, in order (`hidden`: also while a modal hides the sidebar). */
function channelNames(list: 'Text channels' | 'Voice channels') {
  const nav = screen.getByRole('navigation', { name: 'Channels', hidden: true })
  return within(within(nav).getByRole('list', { name: list, hidden: true }))
    .getAllByRole('link', { hidden: true })
    .map((link) => link.textContent?.trim())
}

/** Match toast text whether or not names are wrapped in bidi isolates (see lib/bidi). */
function isolated(text: string) {
  return (content: string) => content.replace(/[\u2068\u2069]/g, '') === text
}

function roomDetailRequests() {
  const count = { value: 0 }
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'GET' && new URL(request.url).pathname === `/api/rooms/${ROOM_ID}`) {
      count.value += 1
    }
  })
  return count
}

/** Hold requests to `method path` until `release()`; the default handlers then answer. */
function holdRequests(method: 'put' | 'delete', path: string) {
  const held: (() => void)[] = []
  let sent = 0
  let released = false
  server.use(
    http[method](path, async () => {
      sent += 1
      if (!released) await new Promise<void>((resolve) => held.push(resolve))
      return undefined
    }),
  )
  return {
    get sent() {
      return sent
    },
    release() {
      released = true
      held.splice(0).forEach((resolve) => resolve())
    },
  }
}

afterEach(() => {
  server.events.removeAllListeners()
})

describe('useRoomEvents: channel events', () => {
  it('channel:created adds text and voice channels to the sidebar', async () => {
    const { topic } = await openChannel('general')

    await broadcast(topic, [
      [
        'channel:created',
        { channel: { id: NEW_CHANNEL_ID, roomId: ROOM_ID, type: 'text', name: 'memes', position: 3 } },
      ],
      [
        'channel:created',
        {
          channel: {
            id: 'c0000000-0000-4000-8000-000000009998',
            roomId: ROOM_ID.toUpperCase(),
            type: 'voice',
            name: 'afk',
            position: 2,
          },
        },
      ],
    ])

    expect(channelNames('Text channels')).toEqual(['general', 'clips', 'planning', 'memes'])
    expect(channelNames('Voice channels')).toEqual(['voice', 'late night', 'afk'])
  })

  it('channel:created twice (echo of our own create) adds it once', async () => {
    const { topic } = await openChannel('general')
    const channel = { id: NEW_CHANNEL_ID, roomId: ROOM_ID, type: 'text', name: 'memes', position: 3 }

    await broadcast(topic, [
      ['channel:created', { channel }],
      ['channel:created', { channel }],
    ])

    expect(channelNames('Text channels')).toEqual(['general', 'clips', 'planning', 'memes'])
  })

  it('channel:updated renames the channel, including the open one', async () => {
    const { topic } = await openChannel('clips')

    await broadcast(topic, [['channel:updated', { channel: { ...clips, name: 'highlights' } }]])

    expect(channelNames('Text channels')).toEqual(['general', 'highlights', 'planning'])
    expect(screen.getByRole('heading', { level: 1, name: 'highlights' })).toBeInTheDocument()
  })

  it('channel:reordered applies the order to that type only', async () => {
    const { topic, queryClient } = await openChannel('general')

    await broadcast(topic, [
      [
        'channel:reordered',
        { roomId: ROOM_ID, type: 'text', channelIds: [planning.id, general.id, clips.id] },
      ],
    ])

    expect(channelNames('Text channels')).toEqual(['planning', 'general', 'clips'])
    expect(channelNames('Voice channels')).toEqual(['voice', 'late night'])
    // The default channel follows the lowest text channel.
    expect(queryClient.getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))?.defaultChannelId).toBe(
      planning.id,
    )
  })

  it('channel:deleted for a channel not on screen removes it quietly', async () => {
    const { topic, router } = await openChannel('general')

    await broadcast(topic, [['channel:deleted', { id: clips.id, roomId: ROOM_ID }]])

    expect(channelNames('Text channels')).toEqual(['general', 'planning'])
    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(screen.queryByText(/was deleted/)).not.toBeInTheDocument()
  })

  it('channel:deleted while viewing it: lands on the lowest remaining text channel and toasts', async () => {
    const { topic, router } = await openChannel('general')

    await broadcast(topic, [['channel:deleted', { id: general.id.toUpperCase(), roomId: ROOM_ID }]])

    expect(await screen.findByText(isolated('#general was deleted.'))).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'clips')),
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'clips' })).toBeInTheDocument()
    expect(channelNames('Text channels')).toEqual(['clips', 'planning'])
    // Replaced, so Back doesn't return to the deleted channel.
    expect(router.history.length).toBe(1)
  })

  it('channel:deleted for the voice channel you are in resets the voice session', async () => {
    useVoiceStore.setState({
      connection: {
        status: 'connected',
        roomId: ROOM_ID,
        roomName: nightOwls.room.name,
        channelId: voice.id,
        channelName: voice.name,
      },
    })
    const { topic, router } = await openChannel('general')

    await broadcast(topic, [['channel:deleted', { id: voice.id, roomId: ROOM_ID }]])

    expect(useVoiceStore.getState().connection?.channelId).not.toBe(voice.id)
    expect(channelNames('Voice channels')).toEqual(['late night'])
    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(screen.queryByText(/was deleted/)).not.toBeInTheDocument()
  })

  it('ignores channel events for another room and invalid payloads', async () => {
    const { topic, queryClient } = await openChannel('general')
    const before = queryClient.getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))
    const otherRoom = pitLane.room.id

    await broadcast(topic, [
      [
        'channel:created',
        { channel: { id: NEW_CHANNEL_ID, roomId: otherRoom, type: 'text', name: 'memes', position: 3 } },
      ],
      ['channel:updated', { channel: { ...clips, roomId: otherRoom, name: 'x' } }],
      [
        'channel:reordered',
        { roomId: otherRoom, type: 'text', channelIds: [planning.id, clips.id, general.id] },
      ],
      ['channel:deleted', { id: clips.id, roomId: otherRoom }],
      // Invalid: bad type, missing roomId, bad ids.
      ['channel:created', { channel: { ...clips, type: 'stage' } }],
      ['channel:updated', { channel: { ...clips, roomId: undefined } }],
      ['channel:reordered', { roomId: ROOM_ID, type: 'text', channelIds: ['x'] }],
      ['channel:deleted', { id: clips.id }],
    ])

    expect(queryClient.getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))).toBe(before)
    expect(channelNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })

  it("channel:reordered during this tab's reorder keeps the optimistic order, then refetches", async () => {
    const put = holdRequests('put', '*/api/rooms/:roomId/channels/order')
    const user = userEvent.setup()
    const { topic, queryClient } = await openChannel('general')

    await user.click(screen.getByRole('button', { name: 'Channel options for #general' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }))
    await vi.waitFor(() => expect(put.sent).toBe(1))
    expect(channelNames('Text channels')).toEqual(['clips', 'general', 'planning'])
    const requests = roomDetailRequests()

    // Another admin's reorder lands on the server after ours.
    const serverOrder = [planning, clips, general].map((channel, position) => ({
      ...channel,
      position,
    }))
    await broadcast(topic, [
      [
        'channel:reordered',
        { roomId: ROOM_ID, type: 'text', channelIds: serverOrder.map((channel) => channel.id) },
      ],
    ])
    // Not clobbered while our PUT is in flight, and no refetch that could land before it.
    expect(channelNames('Text channels')).toEqual(['clips', 'general', 'planning'])
    expect(requests.value).toBe(0)

    server.use(
      http.get(`*/api/rooms/${ROOM_ID}`, () =>
        HttpResponse.json({
          ...nightOwls,
          defaultChannelId: planning.id,
          channels: [...serverOrder, ...nightOwls.channels.filter((c) => c.type === 'voice')],
        }),
      ),
    )
    // Our PUT's response is applied, then the refetch brings the server's final order.
    await act(async () => {
      put.release()
      await vi.waitFor(() => expect(requests.value).toBe(1))
      await vi.waitFor(() =>
        expect(queryClient.getQueryState(roomKeys.detail(ROOM_ID))?.fetchStatus).toBe('idle'),
      )
    })
    expect(channelNames('Text channels')).toEqual(['planning', 'clips', 'general'])
    expect(requests.value).toBe(1)
  })

  /** Hold the reorder PUT and move #general down (optimistic: clips, general, planning). */
  async function moveGeneralDownAndHold() {
    const put = holdRequests('put', '*/api/rooms/:roomId/channels/order')
    const user = userEvent.setup()
    const view = await openChannel('general')
    await user.click(screen.getByRole('button', { name: 'Channel options for #general' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }))
    await vi.waitFor(() => expect(put.sent).toBe(1))
    expect(channelNames('Text channels')).toEqual(['clips', 'general', 'planning'])
    return { ...view, put }
  }

  it("our own channel:reordered echo during the PUT doesn't refetch the room", async () => {
    const { topic, queryClient, put } = await moveGeneralDownAndHold()
    const requests = roomDetailRequests()

    await broadcast(topic, [
      [
        'channel:reordered',
        // The exact order the PUT sent, ids in another case.
        { roomId: ROOM_ID, type: 'text', channelIds: [clips.id, general.id.toUpperCase(), planning.id] },
      ],
    ])
    await act(async () => {
      put.release()
      await vi.waitFor(() => expect(isReorderingChannels(queryClient, ROOM_ID)).toBe(false))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(requests.value).toBe(0)
    expect(channelNames('Text channels')).toEqual(['clips', 'general', 'planning'])
  })

  it('channel:updated during the PUT keeps the optimistic position, then refetches', async () => {
    const { topic, queryClient, put } = await moveGeneralDownAndHold()
    const requests = roomDetailRequests()

    // Renamed elsewhere; the broadcast carries the server's pre-reorder position.
    await broadcast(topic, [['channel:updated', { channel: { ...general, name: 'lobby' } }]])

    expect(channelNames('Text channels')).toEqual(['clips', 'lobby', 'planning'])
    const positions = queryClient
      .getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))
      ?.channels.filter((channel) => channel.type === 'text')
      .map((channel) => channel.position)
    expect(positions).toEqual([0, 1, 2])
    expect(requests.value).toBe(0)

    // The server has both changes; the PUT's response (the fixture) still says #general.
    const renamed = [clips, general, planning].map((channel, position) => ({
      ...channel,
      position,
      name: channel.id === general.id ? 'lobby' : channel.name,
    }))
    server.use(
      http.get(`*/api/rooms/${ROOM_ID}`, () =>
        HttpResponse.json({
          ...nightOwls,
          defaultChannelId: clips.id,
          channels: [...renamed, ...nightOwls.channels.filter((c) => c.type === 'voice')],
        }),
      ),
    )
    await act(async () => {
      put.release()
      await vi.waitFor(() => expect(requests.value).toBe(1))
      await vi.waitFor(() =>
        expect(queryClient.getQueryState(roomKeys.detail(ROOM_ID))?.fetchStatus).toBe('idle'),
      )
    })
    expect(channelNames('Text channels')).toEqual(['clips', 'lobby', 'planning'])
  })

  it('channel:updated with no reorder in flight takes the position as sent', async () => {
    const { topic, queryClient } = await openChannel('general')

    await broadcast(topic, [['channel:updated', { channel: { ...planning, name: 'plans' } }]])

    expect(channelNames('Text channels')).toEqual(['general', 'clips', 'plans'])
    expect(
      queryClient.getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))?.channels.find(
        (channel) => channel.id === planning.id,
      ),
    ).toEqual({ ...planning, name: 'plans' })
  })

  it('channel:deleted while this tab deletes it: one toast, from the delete', async () => {
    const del = holdRequests('delete', '*/api/channels/:channelId')
    const user = userEvent.setup()
    const { topic, router } = await openChannel('clips')

    await user.click(screen.getByRole('button', { name: 'Channel options for #clips' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete #clips?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete channel' }))
    await vi.waitFor(() => expect(del.sent).toBe(1))

    // The server broadcasts before this tab's request has answered.
    await broadcast(topic, [['channel:deleted', { id: clips.id, roomId: ROOM_ID }]])
    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'clips'))
    expect(channelNames('Text channels')).toEqual(['general', 'clips', 'planning'])

    await act(async () => {
      del.release()
      await vi.waitFor(() =>
        expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general')),
      )
    })
    expect(await screen.findByText(isolated('Deleted #clips'))).toBeInTheDocument()
    expect(screen.queryByText(isolated('#clips was deleted.'))).not.toBeInTheDocument()
    expect(channelNames('Text channels')).toEqual(['general', 'planning'])
  })

  it('unmounting during a deferred reorder cancels the wait', async () => {
    const put = holdRequests('put', '*/api/rooms/:roomId/channels/order')
    const user = userEvent.setup()
    const { topic, queryClient, unmount } = await openChannel('general')
    await user.click(screen.getByRole('button', { name: 'Channel options for #general' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }))
    await vi.waitFor(() => expect(put.sent).toBe(1))
    // `listeners` is a plain field on TanStack Query's Subscribable.
    const listeners = () =>
      (queryClient.getMutationCache() as unknown as { listeners: Set<unknown> }).listeners.size
    const baseline = listeners()

    await broadcast(topic, [
      [
        'channel:reordered',
        { roomId: ROOM_ID, type: 'text', channelIds: [planning.id, clips.id, general.id] },
      ],
    ])
    expect(listeners()).toBe(baseline + 1)

    unmount()
    expect(listeners()).toBe(0)
    // The room is refetched on the next visit instead.
    expect(queryClient.getQueryState(roomKeys.detail(ROOM_ID))?.isInvalidated).toBe(true)
    put.release()
  })
})
