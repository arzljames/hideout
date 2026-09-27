import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomEvent } from 'livekit-client'
import { http, HttpResponse } from 'msw'
import { useVoiceSession } from '@/features/voice'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeLiveKit } from '@/test/fake-livekit'
import { fakeSupabase, type FakeChannel } from '@/test/fake-supabase'
import { meFixture } from '@/test/fixtures/me'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { recordRequests } from '@/test/msw/requests'
import { voiceParticipantsHandler } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { setVoiceConnected } from '@/test/voice'

failOnConsoleError()

const ROOM_ID = nightOwls.room.id
const voice = channelOf(nightOwls, 'voice')
const lateNight = channelOf(nightOwls, 'late night')
const NEW_CHANNEL_ID = 'c0000000-0000-4000-8000-000000009999'

function person(name: string) {
  const member = nightOwls.members.find((m) => m.user.displayName === name)
  if (!member) throw new Error(`no member ${name}`)
  return member.user
}
const maya = person('Maya')
const jun = person('Jun')
const me = person('Arzl')

let tokenRequests = 0

beforeEach(() => {
  tokenRequests = 0
  server.use(
    http.post('*/api/channels/:channelId/voice/token', () => {
      tokenRequests += 1
      return HttpResponse.json({
        token: `token-${tokenRequests}`,
        url: 'wss://livekit.test',
        roomName: 'voice_x',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    }),
  )
})

function channelNav() {
  return screen.getByRole('navigation', { name: 'Channels' })
}

/** The people listed under a voice channel in the sidebar ("In <name>"), or [] when none. */
function sidebarPeople(channelName: string) {
  const list = within(channelNav()).queryByRole('list', { name: `In ${channelName}` })
  if (!list) return []
  return within(list).getAllByRole('listitem').map(spokenText)
}

/** A person's row under a voice channel in the sidebar. */
function sidebarItem(channelName: string, name: string) {
  const list = within(channelNav()).getByRole('list', { name: `In ${channelName}` })
  const item = within(list)
    .getAllByRole('listitem')
    .find((row) => spokenText(row)?.startsWith(name))
  if (!item) throw new Error(`${name} is not listed in ${channelName}`)
  return item
}

/** An element's text as a screen reader gets it: without aria-hidden parts (avatar initials). */
function spokenText(element: Element) {
  const copy = element.cloneNode(true) as Element
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return copy.textContent?.replace(/\s+/g, ' ').trim()
}

function tiles() {
  const list = screen.queryByRole('list', { name: 'Participants' })
  if (!list) return []
  return within(list).getAllByRole('listitem')
}

function tileFor(name: string) {
  const tile = tiles().find((item) => within(item).queryByText(name))
  if (!tile) throw new Error(`no tile for ${name}`)
  return tile
}

async function joinStore(channel = voice) {
  await act(() =>
    useVoiceSession.getState().join({
      roomId: ROOM_ID,
      roomName: nightOwls.room.name,
      channelId: channel.id,
      channelName: channel.name,
    }),
  )
}

async function roomTopic(): Promise<FakeChannel> {
  await vi.waitFor(() => expect(fakeSupabase.channelsFor(`room:${ROOM_ID}`)).toHaveLength(1))
  return fakeSupabase.channelsFor(`room:${ROOM_ID}`)[0]!
}

async function broadcast(topic: FakeChannel, event: string, payload: unknown) {
  await act(async () => {
    topic.emitBroadcast(event, payload)
    for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** The app's polite voice announcer, found by what it last said. */
async function announcer(said: string | RegExp) {
  const live = await screen.findByText(said, { selector: '[role="status"]' })
  expect(live).toHaveAttribute('aria-live', 'polite')
  return live
}

describe('voice participants', () => {
  it('loads who is in each voice channel when the room opens', async () => {
    server.use(voiceParticipantsHandler({ [voice.id]: [maya, jun], [lateNight.id]: [] }))

    await renderRoute(roomPath(nightOwls, 'voice'))

    await waitFor(() => expect(sidebarPeople('voice')).toEqual(['Maya', 'Jun']))
    expect(sidebarPeople('late night')).toEqual([])
    expect(tiles().map((tile) => within(tile).getByText(/Maya|Jun/).textContent)).toEqual([
      'Maya',
      'Jun',
    ])
    expect(screen.getByText('2 in voice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
  })

  it('an empty channel says so and offers Join voice', async () => {
    await renderRoute(roomPath(nightOwls, 'voice'))

    expect(screen.getByRole('heading', { level: 2, name: "No one's in voice" })).toBeInTheDocument()
    expect(screen.getByText('Join voice and anyone in Night Owls can hop in with you.')).toBeInTheDocument()
    expect(tiles()).toEqual([])
  })

  it('a failed participants load leaves the lists empty and the room usable', async () => {
    server.use(
      http.get('*/api/rooms/:roomId/voice/participants', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'Nope.' } }, { status: 500 }),
      ),
    )

    await renderRoute(roomPath(nightOwls, 'voice'))

    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
    expect(sidebarPeople('voice')).toEqual([])
  })

  it('reloads the lists each time the room is opened', async () => {
    const requests = recordRequests('get', '*/api/rooms/:roomId/voice/participants')
    const { router } = await renderRoute(roomPath(nightOwls, 'voice'))
    await waitFor(() => expect(requests.count).toBe(1))

    act(() => {
      void router.navigate({ to: '/' })
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    act(() => {
      void router.navigate({ to: roomPath(nightOwls, 'general') })
    })
    await waitFor(() => expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general')))
    await waitFor(() => expect(requests.count).toBe(2))
  })

  it('refetches the lists after Realtime rejoins (broadcasts sent meanwhile are lost)', async () => {
    let byChannel: Record<string, typeof maya[]> = {}
    server.use(
      http.get('*/api/rooms/:roomId/voice/participants', () =>
        HttpResponse.json({
          data: [
            { channelId: voice.id, participants: byChannel[voice.id] ?? [] },
            { channelId: lateNight.id, participants: [] },
          ],
        }),
      ),
    )
    await renderRoute(roomPath(nightOwls, 'general'))
    const topic = await roomTopic()
    byChannel = { [voice.id]: [maya] }

    act(() => topic.emitStatus('SUBSCRIBED'))
    act(() => {
      topic.emitStatus('CHANNEL_ERROR', new Error('socket closed'))
      topic.emitStatus('SUBSCRIBED')
    })

    await waitFor(() => expect(sidebarPeople('voice')).toEqual(['Maya']))
  })

  it('voice:participants replaces the list; a newly created voice channel gets one too', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))
    const topic = await roomTopic()
    await waitFor(() => expect(within(channelNav()).getByRole('link', { name: 'voice' })).toBeInTheDocument())

    await broadcast(topic, 'voice:participants', { channelId: voice.id, participants: [maya, jun] })
    expect(sidebarPeople('voice')).toEqual(['Maya', 'Jun'])
    await broadcast(topic, 'voice:participants', { channelId: voice.id, participants: [] })
    expect(sidebarPeople('voice')).toEqual([])

    await broadcast(topic, 'channel:created', {
      channel: { id: NEW_CHANNEL_ID, roomId: ROOM_ID, type: 'voice', name: 'afk', position: 2 },
    })
    await broadcast(topic, 'voice:participants', { channelId: NEW_CHANNEL_ID, participants: [jun] })

    expect(sidebarPeople('afk')).toEqual(['Jun'])
  })

  it('shows you in the channel while connected, once, even before the list includes you', async () => {
    server.use(voiceParticipantsHandler({ [voice.id]: [maya] }))
    setVoiceConnected(nightOwls, voice)
    await renderRoute(roomPath(nightOwls, 'voice'))

    await waitFor(() => expect(sidebarPeople('voice')).toEqual(['Maya', 'Arzl']))
    expect(within(tileFor('Arzl')).getByText('(you)')).toBeInTheDocument()

    const topic = await roomTopic()
    await broadcast(topic, 'voice:participants', { channelId: voice.id, participants: [maya, me] })
    expect(sidebarPeople('voice')).toEqual(['Maya', 'Arzl'])
    expect(tiles()).toHaveLength(2)
  })

  it('does not show you in a channel you are only joining', async () => {
    setVoiceConnected(nightOwls, voice, { status: 'connecting' })
    await renderRoute(roomPath(nightOwls, 'voice'))

    expect(sidebarPeople('voice')).toEqual([])
    expect(within(screen.getByRole('main')).getByText('Connecting…')).toBeInTheDocument()
  })

  it("shows your own mute and deafen state, and nobody else's", async () => {
    server.use(voiceParticipantsHandler({ [voice.id]: [maya, me] }))
    setVoiceConnected(nightOwls, voice)
    await renderRoute(roomPath(nightOwls, 'voice'))
    await waitFor(() => expect(tiles()).toHaveLength(2))

    act(() => useVoiceSession.getState().toggleMute())
    expect(within(tileFor('Arzl')).getByText('Muted')).toBeInTheDocument()
    expect(within(tileFor('Maya')).queryByText('Muted')).not.toBeInTheDocument()
    expect(within(sidebarItem('voice', 'Arzl')).getByText(', muted')).toBeInTheDocument()
    expect(within(sidebarItem('voice', 'Maya')).queryByText(', muted')).not.toBeInTheDocument()

    act(() => useVoiceSession.getState().toggleDeafen())
    expect(within(tileFor('Arzl')).getByText('Deafened')).toBeInTheDocument()
    expect(within(tileFor('Arzl')).queryByText('Muted')).not.toBeInTheDocument()
    expect(within(sidebarItem('voice', 'Arzl')).getByText(', deafened')).toBeInTheDocument()
    expect(within(sidebarItem('voice', 'Arzl')).queryByText(', muted')).not.toBeInTheDocument()
  })

  it('rings whoever LiveKit says is speaking, matching ids case-insensitively', async () => {
    server.use(voiceParticipantsHandler({ [voice.id]: [maya, jun] }))
    await renderRoute(roomPath(nightOwls, 'voice'))
    await joinStore(voice)
    await waitFor(() => expect(tiles()).toHaveLength(3))

    act(() =>
      fakeLiveKit.room.emit(RoomEvent.ActiveSpeakersChanged, [
        { identity: maya.id.toUpperCase() },
        { identity: meFixture.id },
      ]),
    )

    expect(within(tileFor('Maya')).getByText('Speaking')).toBeInTheDocument()
    expect(within(tileFor('Arzl')).getByText('Speaking')).toBeInTheDocument()
    expect(within(tileFor('Jun')).queryByText('Speaking')).not.toBeInTheDocument()
    expect(sidebarPeople('voice')).toEqual(['Maya, speaking', 'Jun', 'Arzl, speaking'])

    act(() => fakeLiveKit.room.emit(RoomEvent.ActiveSpeakersChanged, []))
    expect(screen.queryByText('Speaking')).not.toBeInTheDocument()
  })

  it('only rings people in the channel you are in', async () => {
    server.use(voiceParticipantsHandler({ [lateNight.id]: [maya] }))
    await renderRoute(roomPath(nightOwls, 'late night'))
    await joinStore(voice)
    await waitFor(() => expect(sidebarPeople('late night')).toEqual(['Maya']))

    act(() => fakeLiveKit.room.emit(RoomEvent.ActiveSpeakersChanged, [{ identity: maya.id }]))

    expect(sidebarPeople('late night')).toEqual(['Maya'])
    expect(within(tileFor('Maya')).queryByText('Speaking')).not.toBeInTheDocument()
  })

  it('never announces who is speaking', async () => {
    server.use(voiceParticipantsHandler({ [voice.id]: [maya] }))
    await renderRoute(roomPath(nightOwls, 'voice'))
    await joinStore(voice)
    const live = await announcer(/Joined voice in/)

    act(() => fakeLiveKit.room.emit(RoomEvent.ActiveSpeakersChanged, [{ identity: maya.id }]))
    act(() => fakeLiveKit.room.emit(RoomEvent.ActiveSpeakersChanged, []))

    expect(live).toHaveTextContent(/^Joined voice in (\u2068)?voice(\u2069)?\.$/)
  })
})

describe('sidebar voice channel', () => {
  it('a click opens the channel and joins it', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(roomPath(nightOwls, 'general'))

    await user.click(within(channelNav()).getByRole('link', { name: 'voice' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'voice')))
    expect(await screen.findByText("You're in this channel")).toBeInTheDocument()
    expect(within(channelNav()).getByRole('link', { name: 'voice (connected)' })).toBeInTheDocument()
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(1)
  })

  it('clicking the channel you are in only opens it', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(roomPath(nightOwls, 'general'))
    await joinStore(voice)

    await user.click(within(channelNav()).getByRole('link', { name: 'voice (connected)' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'voice')))
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(1)
    expect(tokenRequests).toBe(1)
    expect(fakeLiveKit.room.disconnect).not.toHaveBeenCalled()
  })

  it('clicking another voice channel moves you there', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    await joinStore(voice)

    await user.click(within(channelNav()).getByRole('link', { name: 'late night' }))

    await waitFor(() =>
      expect(useVoiceSession.getState()).toMatchObject({ status: 'connected', channelId: lateNight.id }),
    )
    expect(fakeLiveKit.FakeRoom.instances[0]!.disconnect).toHaveBeenCalled()
    expect(within(channelNav()).getByRole('link', { name: 'late night (connected)' })).toBeInTheDocument()
    expect(within(channelNav()).getByRole('link', { name: 'voice' })).toBeInTheDocument()
  })

  it('a Ctrl/⌘-click (open in a new tab) does not join', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))
    const link = within(channelNav()).getByRole('link', { name: 'voice' })

    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey'] as const) {
      act(() => {
        fireEvent.click(link, { button: 0, [modifier]: true })
      })
    }

    expect(useVoiceSession.getState().status).toBe('idle')
    expect(fakeLiveKit.createLocalAudioTrack).not.toHaveBeenCalled()
  })
})

describe('JoinVoiceBar', () => {
  it('in the channel: "You\'re in this channel" with Leave voice, which leaves', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'voice'))
    await joinStore(voice)

    expect(screen.getByText("You're in this channel")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leave voice' }))

    expect(useVoiceSession.getState().status).toBe('idle')
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
  })

  it('reconnecting: says so, and keeps Leave voice', async () => {
    await renderRoute(roomPath(nightOwls, 'voice'))
    await joinStore(voice)

    act(() => fakeLiveKit.room.emit(RoomEvent.Reconnecting))

    expect(within(screen.getByRole('main')).getByText('Reconnecting…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave voice' })).toBeInTheDocument()
  })

  it('in another channel of the room, this one still offers Join voice', async () => {
    server.use(voiceParticipantsHandler({ [lateNight.id]: [maya] }))
    await renderRoute(roomPath(nightOwls, 'late night'))
    await joinStore(voice)

    await waitFor(() => expect(screen.getByText('1 in voice')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
    expect(screen.queryByText("You're in this channel")).not.toBeInTheDocument()
  })

  it("a failed join shows only on that channel's page", async () => {
    fakeLiveKit.FakeRoom.nextConnect = { error: new Error('refused') }
    await renderRoute(roomPath(nightOwls, 'late night'))
    await joinStore(voice)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
  })
})

describe('voice announcements', () => {
  it('announces joining, reconnecting, reconnected and leaving', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))

    await joinStore(lateNight)
    const live = await announcer(/Joined voice in/)
    expect(live.textContent?.replace(/[\u2068\u2069]/g, '')).toBe('Joined voice in late night.')

    act(() => fakeLiveKit.room.emit(RoomEvent.Reconnecting))
    expect(live).toHaveTextContent('Reconnecting to voice…')

    act(() => fakeLiveKit.room.emit(RoomEvent.Reconnected))
    expect(live).toHaveTextContent('Reconnected to voice.')

    await act(() => useVoiceSession.getState().leave())
    expect(live).toHaveTextContent('Left voice.')
  })

  it('does not announce progress or failures (those have their own UI)', async () => {
    fakeLiveKit.FakeRoom.nextConnect = { error: new Error('refused') }
    await renderRoute(roomPath(nightOwls, 'general'))

    await joinStore(voice)

    expect(useVoiceSession.getState().status).toBe('disconnected')
    expect(
      screen.queryByText(/Joined voice|Left voice|Reconnect/, { selector: '[role="status"]' }),
    ).not.toBeInTheDocument()
  })
})
