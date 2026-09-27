import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeSupabase, type FakeChannel } from '@/test/fake-supabase'
import { generalMessages, makeMessage, messageId, people, todayAt } from '@/test/fixtures/messages'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { messageHandlers } from '@/test/msw/messages'
import { roomNotFound } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { messageKeys } from '../message-cache'
import type { Message, MessagePage } from '../types'
import { BACKFILL_LONG_GAP_MS, BACKFILL_MAX_PAGES, BACKFILL_PAGE_SIZE } from './use-channel-messages'

failOnConsoleError()

const ROOM_ID = nightOwls.room.id
const generalId = channelOf(nightOwls, 'general').id
const clipsId = channelOf(nightOwls, 'clips').id
const GENERAL_TOPIC = `channel:${generalId.toLowerCase()}`
const NEWEST_ID = generalMessages.at(-1)!.id

/** A message in #general by Maya, newer than every fixture message. */
function newMessage(n: number, overrides: Partial<Message> = {}): Message {
  return makeMessage({
    id: messageId(100 + n),
    channelId: generalId,
    body: `Live message ${n}`,
    createdAt: todayAt(22, n, 0),
    ...overrides,
  })
}

type Respond = (params: URLSearchParams, n: number) => Response | Promise<Response>

/**
 * Serve backfill reads (`?after=`, or a `cursor` starting with `bf-`) with `respond` and
 * record them; history reads fall through to messageHandlers and are counted.
 */
function backfillServer(respond: Respond = () => page([])) {
  const backfills: URLSearchParams[] = []
  const history = { count: 0 }
  let inFlight = 0
  let maxInFlight = 0
  server.use(
    http.get('*/api/channels/:channelId/messages', async ({ request }) => {
      const params = new URL(request.url).searchParams
      if (!params.has('after') && !params.get('cursor')?.startsWith('bf-')) {
        history.count += 1
        return undefined
      }
      backfills.push(params)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      try {
        return await respond(params, backfills.length)
      } finally {
        inFlight -= 1
      }
    }),
  )
  return {
    backfills,
    history,
    get maxInFlight() {
      return maxInFlight
    },
  }
}

function page(data: Message[], nextCursor: string | null = null): Response {
  return HttpResponse.json({ data, nextCursor } satisfies MessagePage)
}

function liveRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[aria-live="polite"]')
  if (!region) throw new Error('no polite live region')
  return region
}

async function joined(topic: string): Promise<FakeChannel> {
  await waitFor(() => expect(fakeSupabase.channelsFor(topic)).toHaveLength(1))
  return fakeSupabase.channelsFor(topic)[0]!
}

/**
 * Open #general with its fixture history and a backfill server. `join`: emit the first
 * SUBSCRIBED and wait for its catch-up read, so tests start from a live, caught-up channel.
 */
async function openGeneral({ respond, join = true }: { respond?: Respond; join?: boolean } = {}) {
  server.use(...messageHandlers({ [generalId]: generalMessages }))
  const reads = backfillServer(respond)
  const view = await renderRoute(roomPath(nightOwls, 'general'))
  const log = await screen.findByRole('log', { name: 'Messages in #general' })
  await within(log).findByText('Same, joining now')
  const channel = await joined(GENERAL_TOPIC)
  if (join) {
    act(() => channel.emitStatus('SUBSCRIBED'))
    await waitFor(() => expect(reads.backfills).toHaveLength(1))
    await act(async () => {})
  }
  return { ...view, log, channel, reads }
}

function rejoin(channel: FakeChannel) {
  act(() => {
    channel.emitStatus('CHANNEL_ERROR', new Error('socket closed'))
    channel.emitStatus('SUBSCRIBED')
  })
}

/** Shift Date.now (used by the topic registry, the hook, and TanStack Query) forward. */
function controlClock() {
  const realNow = Date.now.bind(Date)
  let offset = 0
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset)
  return {
    advance(ms: number) {
      offset += ms
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  server.events.removeAllListeners()
})

describe('useChannelMessages', () => {
  it('joins the channel topic privately while open and leaves it on unmount', async () => {
    const { router } = await openGeneral({ join: false })
    const channel = fakeSupabase.channelsFor(GENERAL_TOPIC)[0]!
    expect(channel.params).toEqual({ config: { private: true } })

    act(() => {
      void router.navigate({ to: roomPath(nightOwls, 'clips') })
    })
    await screen.findByRole('textbox', { name: 'Message #clips' })

    await joined(`channel:${clipsId.toLowerCase()}`)
    await waitFor(() => expect(fakeSupabase.channelsFor(GENERAL_TOPIC)).toHaveLength(0))
    expect(channel.removed).toBe(true)
  })

  it('does not join a topic for a voice channel', async () => {
    server.use(...messageHandlers({}))
    await renderRoute(roomPath(nightOwls, 'voice'))
    await act(async () => {})
    expect(fakeSupabase.channels.some((c) => c.subTopic.startsWith('channel:'))).toBe(false)
  })

  it('first join catches up once from the newest message', async () => {
    const { reads } = await openGeneral()
    expect(reads.backfills).toHaveLength(1)
    expect(reads.backfills[0]!.get('after')).toBe(NEWEST_ID)
    expect(reads.backfills[0]!.get('limit')).toBe(String(BACKFILL_PAGE_SIZE))
  })

  it('message:created / updated / deleted update the list; created is announced', async () => {
    const { channel, log } = await openGeneral()
    const live = newMessage(1)

    act(() => channel.emitBroadcast('message:created', { message: live }))
    expect(await within(log).findByText('Live message 1')).toBeInTheDocument()
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Maya: Live message 1'))

    act(() =>
      channel.emitBroadcast('message:updated', {
        message: { ...live, body: 'Live message 1, edited', editedAt: todayAt(22, 30) },
      }),
    )
    expect(await within(log).findByText('Live message 1, edited')).toBeInTheDocument()

    act(() => channel.emitBroadcast('message:deleted', { id: live.id, channelId: generalId }))
    await waitFor(() =>
      expect(within(log).queryByText('Live message 1, edited')).not.toBeInTheDocument(),
    )
    // An older message can be deleted too.
    act(() =>
      channel.emitBroadcast('message:deleted', { id: generalMessages[0]!.id, channelId: generalId }),
    )
    await waitFor(() =>
      expect(within(log).queryByText(generalMessages[0]!.body)).not.toBeInTheDocument(),
    )
  })

  it('ignores a repeated message:created', async () => {
    const { channel, log, queryClient } = await openGeneral()
    const live = newMessage(2)

    act(() => {
      channel.emitBroadcast('message:created', { message: live })
      channel.emitBroadcast('message:created', { message: live })
      channel.emitBroadcast('message:created', { message: { ...live, id: live.id.toUpperCase() } })
    })

    expect(await within(log).findAllByText('Live message 2')).toHaveLength(1)
    const data = queryClient.getQueryData<{ pages: MessagePage[] }>(messageKeys.channel(generalId))
    const ids = data!.pages.flatMap((p) => p.data.map((m) => m.id.toLowerCase()))
    expect(ids.filter((id) => id === live.id.toLowerCase())).toHaveLength(1)
  })

  it('ignores payloads for another channel and invalid payloads; matches ids case-insensitively', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { channel, log, queryClient } = await openGeneral()
    const before = queryClient.getQueryData(messageKeys.channel(generalId))

    act(() => {
      channel.emitBroadcast('message:created', { message: newMessage(3, { channelId: clipsId }) })
      channel.emitBroadcast('message:updated', {
        message: { ...generalMessages[0]!, channelId: clipsId, body: 'Hijacked' },
      })
      channel.emitBroadcast('message:deleted', { id: generalMessages[0]!.id, channelId: clipsId })
      channel.emitBroadcast('message:created', { message: { ...newMessage(4), id: 'nope' } })
      channel.emitBroadcast('message:created', { message: newMessage(5, { body: 'x'.repeat(2001) }) })
      channel.emitBroadcast('message:deleted', { id: generalMessages[0]!.id })
      channel.emitBroadcast('message:created', 'not an object')
    })
    await act(async () => {})

    expect(queryClient.getQueryData(messageKeys.channel(generalId))).toBe(before)
    expect(within(log).getByText(generalMessages[0]!.body)).toBeInTheDocument()
    if (import.meta.env.DEV) expect(warn).toHaveBeenCalled()

    act(() =>
      channel.emitBroadcast('message:created', {
        message: newMessage(6, { channelId: generalId.toUpperCase() }),
      }),
    )
    expect(await within(log).findByText('Live message 6')).toBeInTheDocument()
  })

  it('our own echo arriving before the POST response shows one row', async () => {
    const { channel, log } = await openGeneral()
    const mine: Message = {
      id: messageId(500),
      channelId: generalId,
      author: people.me,
      body: 'gg',
      createdAt: todayAt(22, 55),
      editedAt: null,
    }
    let releasePost!: () => void
    const posted = new Promise<void>((resolve) => (releasePost = resolve))
    server.use(
      http.post('*/api/channels/:channelId/messages', async () => {
        await posted
        return HttpResponse.json(mine, { status: 201 })
      }),
    )
    const user = userEvent.setup()

    await user.type(screen.getByRole('textbox', { name: 'Message #general' }), 'gg{Enter}')
    expect(await screen.findByText('Sending…')).toBeInTheDocument()

    act(() => channel.emitBroadcast('message:created', { message: mine }))
    await waitFor(() => expect(screen.queryByText('Sending…')).not.toBeInTheDocument())
    expect(within(log).getAllByText('gg')).toHaveLength(1)

    await act(async () => {
      releasePost()
      await posted
    })
    await act(async () => {})
    expect(within(log).getAllByText('gg')).toHaveLength(1)
    expect(screen.queryByText('Sending…')).not.toBeInTheDocument()
  })

  it('a rejoin after an error backfills once from the newest message, follows nextCursor, dedupes, and stays silent', async () => {
    const missed = [newMessage(10), newMessage(11), newMessage(12)]
    const { channel, log, reads } = await openGeneral({
      respond: (params, n) => {
        if (n === 1) return page([])
        // Overlap: the newest held message comes back too.
        if (params.has('after')) return page([generalMessages.at(-1)!, missed[0]!], 'bf-2')
        return page([missed[0]!, missed[1]!, missed[2]!])
      },
    })

    rejoin(channel)

    expect(await within(log).findByText('Live message 12')).toBeInTheDocument()
    expect(reads.backfills).toHaveLength(3)
    const [, first, second] = reads.backfills
    expect(first!.get('after')).toBe(NEWEST_ID)
    expect(first!.has('cursor')).toBe(false)
    // The cursor is passed alone (the contract: "Not with `after`").
    expect(second!.get('cursor')).toBe('bf-2')
    expect(second!.has('after')).toBe(false)
    expect(within(log).getAllByText('Live message 10')).toHaveLength(1)
    expect(within(log).getAllByText('Same, joining now')).toHaveLength(1)
    expect(reads.history.count).toBe(1)
    // Backfilled messages are not announced as new.
    await act(async () => {})
    expect(liveRegion().textContent).toBe('')
  })

  it('does not bring back a message deleted live while its backfill was in flight', async () => {
    const missed = newMessage(20)
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const { channel, log, reads } = await openGeneral({
      respond: async (_params, n) => {
        if (n === 1) return page([])
        await held
        return page([missed, newMessage(21)])
      },
    })

    rejoin(channel)
    await waitFor(() => expect(reads.backfills).toHaveLength(2))
    act(() => channel.emitBroadcast('message:deleted', { id: missed.id, channelId: generalId }))
    await act(async () => {
      release()
    })

    expect(await within(log).findByText('Live message 21')).toBeInTheDocument()
    expect(within(log).queryByText('Live message 20')).not.toBeInTheDocument()
  })

  it('reloads the history instead of backfilling after a gap over 5 minutes', async () => {
    const clock = controlClock()
    const { channel, reads } = await openGeneral()

    act(() => channel.emitStatus('CHANNEL_ERROR'))
    clock.advance(BACKFILL_LONG_GAP_MS + 1)
    act(() => channel.emitStatus('SUBSCRIBED'))

    await waitFor(() => expect(reads.history.count).toBe(2))
    expect(reads.backfills).toHaveLength(1)
  })

  it('backfills (not reloads) after a gap just under 5 minutes', async () => {
    const clock = controlClock()
    const { channel, reads } = await openGeneral()

    act(() => channel.emitStatus('CHANNEL_ERROR'))
    clock.advance(BACKFILL_LONG_GAP_MS - 1_000)
    act(() => channel.emitStatus('SUBSCRIBED'))

    await waitFor(() => expect(reads.backfills).toHaveLength(2))
    await act(async () => {})
    expect(reads.history.count).toBe(1)
  })

  it('first join reloads a cached history older than 5 minutes', async () => {
    const clock = controlClock()
    const { channel, reads } = await openGeneral({ join: false })

    clock.advance(BACKFILL_LONG_GAP_MS + 1)
    act(() => channel.emitStatus('SUBSCRIBED'))

    await waitFor(() => expect(reads.history.count).toBe(2))
    expect(reads.backfills).toHaveLength(0)
  })

  it(`reloads the history when more than ${BACKFILL_MAX_PAGES} backfill pages remain`, async () => {
    const { channel, log, reads } = await openGeneral({
      respond: (_params, n) => {
        if (n === 1) return page([])
        return page([newMessage(30 + n)], `bf-${n + 1}`)
      },
    })

    rejoin(channel)

    await waitFor(() => expect(reads.history.count).toBe(2))
    expect(reads.backfills).toHaveLength(1 + BACKFILL_MAX_PAGES)
    // Nothing partial is merged.
    expect(within(log).queryByText('Live message 32')).not.toBeInTheDocument()
  })

  it('runs one backfill at a time; rejoins meanwhile run it once more afterwards', async () => {
    const gates: Array<() => void> = []
    const { channel, log, reads } = await openGeneral({
      respond: async (_params, n) => {
        if (n === 1) return page([])
        await new Promise<void>((resolve) => gates.push(resolve))
        return page([newMessage(40 + n)])
      },
    })

    rejoin(channel)
    await waitFor(() => expect(gates).toHaveLength(1))
    rejoin(channel)
    rejoin(channel)
    await act(async () => {})
    expect(reads.backfills).toHaveLength(2)

    await act(async () => gates.shift()!())
    expect(await within(log).findByText('Live message 42')).toBeInTheDocument()
    await waitFor(() => expect(gates).toHaveLength(1))
    expect(reads.backfills).toHaveLength(3)
    // The second run starts from the newest message now held.
    expect(reads.backfills[2]!.get('after')).toBe(messageId(142))

    await act(async () => gates.shift()!())
    expect(await within(log).findByText('Live message 43')).toBeInTheDocument()
    await act(async () => {})
    expect(reads.backfills).toHaveLength(3)
    expect(reads.maxInFlight).toBe(1)
  })

  it('a 404 during backfill takes the channels error path (room gone: leaves the room)', async () => {
    const { channel, router } = await openGeneral({
      respond: (_params, n) =>
        n === 1
          ? page([])
          : HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Channel not found.' } }, { status: 404 }),
    })
    const roomReads = { count: 0 }
    server.use(
      http.get(`*/api/rooms/${ROOM_ID}`, () => {
        roomReads.count += 1
        return roomNotFound()
      }),
    )

    rejoin(channel)

    await waitFor(() => expect(roomReads.count).toBeGreaterThan(0))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('stops a backfill when the channel closes, merging nothing', async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const { channel, router, queryClient, reads } = await openGeneral({
      respond: async (_params, n) => {
        if (n === 1) return page([])
        await held
        return page([newMessage(50)])
      },
    })

    rejoin(channel)
    await waitFor(() => expect(reads.backfills).toHaveLength(2))
    act(() => {
      void router.navigate({ to: roomPath(nightOwls, 'clips') })
    })
    await screen.findByRole('textbox', { name: 'Message #clips' })
    await act(async () => release())
    await act(async () => {})

    const data = queryClient.getQueryData<{ pages: MessagePage[] }>(messageKeys.channel(generalId))
    expect(data!.pages.flatMap((p) => p.data).some((m) => m.id === messageId(150))).toBe(false)
  })

  it('shows our send as failed when its echo-like message was not ours and the POST fails', async () => {
    const { channel } = await openGeneral()
    let rejectPost!: () => void
    const posted = new Promise<void>((resolve) => (rejectPost = resolve))
    server.use(
      http.post('*/api/channels/:channelId/messages', async () => {
        await posted
        return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'No.' } }, { status: 403 })
      }),
    )
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Message #general' }), 'gg{Enter}')
    expect(await screen.findByText('Sending…')).toBeInTheDocument()

    // Same author and body, but sent from another tab: it hides our pending row for now.
    const otherTab: Message = {
      id: messageId(501),
      channelId: generalId,
      author: people.me,
      body: 'gg',
      createdAt: todayAt(22, 56),
      editedAt: null,
    }
    act(() => channel.emitBroadcast('message:created', { message: otherTab }))
    await waitFor(() => expect(screen.queryByText('Sending…')).not.toBeInTheDocument())

    await act(async () => {
      rejectPost()
      await posted
    })

    expect(await screen.findByText(/Couldn't send/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('ignores message:updated for a message that is not loaded', async () => {
    const { channel, log } = await openGeneral()
    const old = newMessage(40, { createdAt: '2020-01-01T12:00:00.000Z', body: 'Ancient history' })

    act(() =>
      channel.emitBroadcast('message:updated', {
        message: { ...old, editedAt: todayAt(22, 40) },
      }),
    )
    await act(async () => {})

    expect(within(log).queryByText('Ancient history')).not.toBeInTheDocument()
  })

  it('does not bring back a message this tab deleted while a backfill was in flight', async () => {
    const own = generalMessages.at(-1)!
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const { channel, log, reads } = await openGeneral({
      respond: async (_params, n) => {
        if (n === 1) return page([])
        await held
        // A newer edit of the message: normally worth merging.
        return page([{ ...own, body: 'Resurrected', editedAt: todayAt(23, 0) }])
      },
    })
    const user = userEvent.setup()

    rejoin(channel)
    await waitFor(() => expect(reads.backfills).toHaveLength(2))
    const row = within(log).getByText(own.body).closest<HTMLElement>('[role="article"]')!
    await user.click(within(row).getByRole('button', { name: 'Delete message' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete message' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

    await act(async () => {
      release()
    })
    await act(async () => {})

    expect(within(log).queryByText('Resurrected')).not.toBeInTheDocument()
    expect(within(log).queryByText(own.body)).not.toBeInTheDocument()
  })
})
