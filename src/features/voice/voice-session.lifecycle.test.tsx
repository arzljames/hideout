import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DisconnectReason, RoomEvent } from 'livekit-client'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeSupabase, type FakeChannel } from '@/test/fake-supabase'
import {
  FakeAudioContext,
  FakeRemoteTrack,
  fakeLiveKit,
  stubWebAudio,
  type FakeMicTrack,
  type FakeRoom,
} from '@/test/fake-livekit'
import { meFixture } from '@/test/fixtures/me'
import { channelOf, nightOwls, pitLane, roomPath } from '@/test/fixtures/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { useVoiceSession, VOICE_MESSAGES } from './voice-session'

failOnConsoleError()

const ROOM_ID = nightOwls.room.id
const voice = channelOf(nightOwls, 'voice')
const lateNight = channelOf(nightOwls, 'late night')

beforeEach(() => {
  server.use(
    http.post('*/api/channels/:channelId/voice/token', () =>
      HttpResponse.json({
        token: 'a-token',
        url: 'wss://livekit.test',
        roomName: 'voice_x',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ),
  )
})

/** Match text whether or not names are wrapped in bidi isolates (see lib/bidi). */
function isolated(text: string) {
  return (content: string) => content.replace(/[\u2068\u2069]/g, '') === text
}

function voiceBar() {
  return screen.queryByRole('region', { name: 'Voice connection' })
}

interface Session {
  room: FakeRoom
  mic: FakeMicTrack
  /** A remote participant's audio, playing through an <audio> element. */
  audio: HTMLMediaElement
  gain: FakeAudioContext
}

/**
 * Open `path`, join `channel` with every resource a session holds: LiveKit listeners, the mic,
 * a remote audio element, and a mic gain AudioContext (input volume below 100).
 */
async function inFullSession(path: string, channel = voice) {
  stubWebAudio()
  const user = userEvent.setup()
  const view = await renderRoute(path)
  act(() => useVoiceSession.getState().setInputVolume(50))
  await act(() =>
    useVoiceSession.getState().join({
      roomId: ROOM_ID,
      roomName: nightOwls.room.name,
      channelId: channel.id,
      channelName: channel.name,
    }),
  )
  const { room, mic } = fakeLiveKit
  await vi.waitFor(() => expect(mic.setProcessor).toHaveBeenCalled())
  const remote = new FakeRemoteTrack('audio')
  act(() => room.emit(RoomEvent.TrackSubscribed, remote))
  const audio = remote.elements[0]!
  expect(audio.isConnected).toBe(true)
  expect(room.listenerCount).toBeGreaterThan(0)
  const session: Session = { room, mic, audio, gain: FakeAudioContext.instances[0]! }
  expect(await screen.findByRole('region', { name: 'Voice connection' })).toBeInTheDocument()
  return { user, session, ...view }
}

/** Everything the session held is released. */
function expectTornDown({ room, mic, audio, gain }: Session) {
  expect(mic.stop).toHaveBeenCalled()
  expect(room.disconnect).toHaveBeenCalled()
  expect(room.listenerCount).toBe(0)
  expect(audio.isConnected).toBe(false)
  expect(gain.close).toHaveBeenCalled()
}

function expectStillConnected({ room, mic, audio }: Session) {
  expect(useVoiceSession.getState().status).toBe('connected')
  expect(mic.stop).not.toHaveBeenCalled()
  expect(room.disconnect).not.toHaveBeenCalled()
  expect(audio.isConnected).toBe(true)
}

async function topic(name: string): Promise<FakeChannel> {
  await vi.waitFor(() => expect(fakeSupabase.channelsFor(name)).toHaveLength(1))
  return fakeSupabase.channelsFor(name)[0]!
}

/** Broadcast, then let async handlers (navigation, refetches) settle. */
async function broadcast(channel: FakeChannel, event: string, payload: unknown) {
  await act(async () => {
    channel.emitBroadcast(event, payload)
    for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('LiveKit ending the session', () => {
  it.each([
    ['PARTICIPANT_REMOVED', DisconnectReason.PARTICIPANT_REMOVED],
    ['ROOM_DELETED', DisconnectReason.ROOM_DELETED],
    ['ROOM_CLOSED', DisconnectReason.ROOM_CLOSED],
  ])('%s: kicked, so the voice UI goes away with a toast and no retry', async (_, reason) => {
    const { session } = await inFullSession(roomPath(nightOwls, 'voice'))

    act(() => session.room.emit(RoomEvent.Disconnected, reason))

    expect(await screen.findByText(VOICE_MESSAGES.kicked)).toBeInTheDocument()
    expect(voiceBar()).not.toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({ status: 'kicked', channelId: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
    expectTornDown(session)
  })

  it('CLIENT_INITIATED: back to idle silently', async () => {
    const { session } = await inFullSession(roomPath(nightOwls, 'voice'))

    act(() => session.room.emit(RoomEvent.Disconnected, DisconnectReason.CLIENT_INITIATED))

    await vi.waitFor(() => expect(voiceBar()).not.toBeInTheDocument())
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(VOICE_MESSAGES.kicked)).not.toBeInTheDocument()
    expect(screen.queryByText(VOICE_MESSAGES.lost)).not.toBeInTheDocument()
    expectTornDown(session)
  })

  it.each([
    ['DUPLICATE_IDENTITY', DisconnectReason.DUPLICATE_IDENTITY, VOICE_MESSAGES.elsewhere],
    ['SIGNAL_CLOSE', DisconnectReason.SIGNAL_CLOSE, VOICE_MESSAGES.lost],
    ['UNKNOWN_REASON', DisconnectReason.UNKNOWN_REASON, VOICE_MESSAGES.lost],
    ['no reason', undefined, VOICE_MESSAGES.lost],
  ])('%s: disconnected, with a toast and a retry alert on the channel', async (_, reason, message) => {
    const { user, session } = await inFullSession(roomPath(nightOwls, 'voice'))

    act(() => session.room.emit(RoomEvent.Disconnected, reason))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Not connected to voice')
    expect(alert).toHaveTextContent(message)
    expect(voiceBar()).not.toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({ status: 'disconnected', channelId: voice.id })
    // Toasted as well, for when the channel isn't on screen.
    expect(screen.getAllByText(message)).toHaveLength(2)
    expectTornDown(session)

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText("You're in this channel")).toBeInTheDocument()
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(2)
  })

  it('ignores events from a room it already left', async () => {
    const { session } = await inFullSession(roomPath(nightOwls, 'voice'))
    await act(() => useVoiceSession.getState().leave())
    await act(() =>
      useVoiceSession.getState().join({
        roomId: ROOM_ID,
        roomName: nightOwls.room.name,
        channelId: lateNight.id,
        channelName: lateNight.name,
      }),
    )

    // Listeners were removed, but even a straggling emit must not touch the new session.
    act(() => session.room.emit(RoomEvent.Disconnected, DisconnectReason.PARTICIPANT_REMOVED))
    act(() => session.room.emit(RoomEvent.Reconnecting))

    expect(useVoiceSession.getState()).toMatchObject({ status: 'connected', channelId: lateNight.id })
  })
})

describe('leaving voice', () => {
  it('Disconnect in the voice bar releases everything and announces it', async () => {
    const { user, session } = await inFullSession(roomPath(nightOwls, 'general'))

    await user.click(within(voiceBar()!).getByRole('button', { name: 'Disconnect' }))

    expect(voiceBar()).not.toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
    expectTornDown(session)
    expect(await screen.findByText('Left voice.')).toBeInTheDocument()
  })

  it('Leave voice on the channel page releases everything', async () => {
    const { user, session } = await inFullSession(roomPath(nightOwls, 'voice'))

    await user.click(screen.getByRole('button', { name: 'Leave voice' }))

    expect(voiceBar()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
    expectTornDown(session)
  })

  it('stays connected across route changes', async () => {
    const { session, router } = await inFullSession(roomPath(nightOwls, 'voice'))

    for (const to of ['/', '/invites', roomPath(nightOwls, 'general')]) {
      act(() => {
        void router.navigate({ to })
      })
      await waitFor(() => expect(router.state.location.pathname).toBe(to))
    }

    expect(voiceBar()).toBeInTheDocument()
    expectStillConnected(session)
  })

  it('signing out ends voice and forgets mute and deafen', async () => {
    server.use(
      http.post('*/api/auth/logout', () => {
        server.use(http.get('*/api/auth/me', () => new HttpResponse(null, { status: 401 })))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user, session } = await inFullSession('/')
    act(() => useVoiceSession.getState().toggleDeafen())

    await user.click(screen.getByRole('button', { name: 'Arzl, account menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('link', { name: 'Sign in with Steam' })).toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({
      status: 'idle',
      channelId: null,
      muted: false,
      deafened: false,
    })
    expectTornDown(session)
  })

  it('room:deleted for the room ends voice', async () => {
    const { session } = await inFullSession(roomPath(nightOwls, 'general'))
    const room = await topic(`room:${ROOM_ID}`)

    await broadcast(room, 'room:deleted', { id: ROOM_ID })

    expect(await screen.findByText(isolated('Night Owls was deleted.'))).toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
    expectTornDown(session)
  })

  it('member:removed on your user topic ends voice in that room', async () => {
    const { session } = await inFullSession(roomPath(nightOwls, 'general'))
    const user = await topic(`user:${meFixture.id}`)

    await broadcast(user, 'member:removed', { roomId: ROOM_ID })

    expect(await screen.findByText(isolated("You're no longer in Night Owls."))).toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
    expectTornDown(session)
  })

  it('member:removed for another room leaves voice alone', async () => {
    const { session } = await inFullSession(roomPath(nightOwls, 'general'))
    const user = await topic(`user:${meFixture.id}`)

    await broadcast(user, 'member:removed', { roomId: pitLane.room.id, banned: true })

    expect(await screen.findByText(isolated('You were banned from Pit Lane.'))).toBeInTheDocument()
    expectStillConnected(session)
  })

  it('channel:deleted for your voice channel ends voice', async () => {
    const { session } = await inFullSession(roomPath(nightOwls, 'general'))
    const room = await topic(`room:${ROOM_ID}`)

    await broadcast(room, 'channel:deleted', { id: voice.id, roomId: ROOM_ID })

    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
    expect(voiceBar()).not.toBeInTheDocument()
    expectTornDown(session)
  })

  it('channel:deleted for another channel of the room leaves voice alone', async () => {
    const { session } = await inFullSession(roomPath(nightOwls, 'general'))
    const room = await topic(`room:${ROOM_ID}`)

    await broadcast(room, 'channel:deleted', { id: lateNight.id, roomId: ROOM_ID })

    await vi.waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Channels' })).queryByRole('link', {
          name: 'late night',
        }),
      ).not.toBeInTheDocument(),
    )
    expectStillConnected(session)
  })

  it('channel:deleted for your voice channel also clears a failed join left on screen', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))
    fakeLiveKit.FakeRoom.nextConnect = { error: new Error('refused') }
    await act(() =>
      useVoiceSession.getState().join({
        roomId: ROOM_ID,
        roomName: nightOwls.room.name,
        channelId: voice.id,
        channelName: voice.name,
      }),
    )
    expect(useVoiceSession.getState().status).toBe('disconnected')
    const room = await topic(`room:${ROOM_ID}`)

    await broadcast(room, 'channel:deleted', { id: voice.id, roomId: ROOM_ID })

    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
  })
})
