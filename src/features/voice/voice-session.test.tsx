import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DisconnectReason, RoomEvent, Track } from 'livekit-client'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import { deferred, fakeLiveKit } from '@/test/fake-livekit'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { gateRequests } from '@/test/msw/requests'
import { roomDetailHandler, roomNotFound } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { micUnblockSteps } from './lib/mic-help'
import { useVoiceSession, VOICE_MESSAGES, type VoiceTarget } from './voice-session'

failOnConsoleError()

const TOKEN_PATH = '*/api/channels/:channelId/voice/token'

let tokenRequests: { channelId: string; contentType: string | null; body: string }[] = []

/** `POST .../voice/token`: a fresh token per request (`token-1`, `token-2`, …), or `respond`. */
function tokenHandler(respond?: () => Response) {
  return http.post(TOKEN_PATH, async ({ params, request }) => {
    const channelId = String(params.channelId)
    fakeLiveKit.calls.push('token')
    tokenRequests.push({
      channelId,
      contentType: request.headers.get('Content-Type'),
      body: await request.text(),
    })
    if (respond) return respond()
    return HttpResponse.json({
      token: `token-${tokenRequests.length}`,
      url: 'wss://livekit.test',
      roomName: `voice_${channelId}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  })
}

function tokenError(status: number, code: string) {
  return () => HttpResponse.json({ error: { code, message: 'Nope.' } }, { status })
}

beforeEach(() => {
  tokenRequests = []
  server.use(tokenHandler())
})

const voice = channelOf(nightOwls, 'voice')
const lateNight = channelOf(nightOwls, 'late night')

function target(channel: typeof voice): VoiceTarget {
  return {
    roomId: nightOwls.room.id,
    roomName: nightOwls.room.name,
    channelId: channel.id,
    channelName: channel.name,
  }
}

/** Start a join from the store, outside React (no act needed: nothing is rendered). */
function startJoin(channel: typeof voice) {
  return useVoiceSession.getState().join(target(channel))
}

async function openVoiceChannel(name = 'voice') {
  const user = userEvent.setup()
  const view = await renderRoute(roomPath(nightOwls, name))
  return { user, ...view }
}

function voiceBar() {
  return screen.queryByRole('region', { name: 'Voice connection' })
}

async function joinFromPage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Join voice' }))
  const bar = await screen.findByRole('region', { name: 'Voice connection' })
  await within(bar).findByText('Connected')
  return bar
}

/** Match text whether or not names are wrapped in bidi isolates (see lib/bidi). */
function isolated(text: string) {
  return (content: string) => content.replace(/[\u2068\u2069]/g, '') === text
}

describe('joining voice', () => {
  it('asks for the mic first, then fetches a fresh token, connects with it, and publishes the mic', async () => {
    const { user } = await openVoiceChannel()

    await joinFromPage(user)

    expect(fakeLiveKit.calls).toEqual(['mic', 'token', 'connect 0', 'publish'])
    expect(fakeLiveKit.room.connect).toHaveBeenCalledWith('wss://livekit.test', 'token-1')
    expect(await screen.findByText("You're in this channel")).toBeInTheDocument()
  })

  it('posts for the token with the JSON content type and no body', async () => {
    const { user } = await openVoiceChannel()

    await joinFromPage(user)

    expect(tokenRequests).toEqual([
      { channelId: voice.id, contentType: 'application/json', body: '' },
    ])
  })

  it('asks for a processed mic from the saved input device', async () => {
    useVoiceSession.setState({ inputDevice: 'usb-mic' })

    await startJoin(voice)

    expect(fakeLiveKit.createLocalAudioTrack).toHaveBeenCalledWith({
      deviceId: 'usb-mic',
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })
  })

  it('uses the browser default mic when the saved device is "default"', async () => {
    await startJoin(voice)

    expect(fakeLiveKit.createLocalAudioTrack).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: undefined }),
    )
  })

  it('publishes only the microphone: never the camera, screen share or mic helper', async () => {
    await startJoin(voice)

    const { localParticipant } = fakeLiveKit.room
    expect(localParticipant.publishTrack).toHaveBeenCalledTimes(1)
    expect(localParticipant.publishTrack).toHaveBeenCalledWith(fakeLiveKit.mic, {
      source: Track.Source.Microphone,
    })
    expect(localParticipant.setCameraEnabled).not.toHaveBeenCalled()
    expect(localParticipant.setScreenShareEnabled).not.toHaveBeenCalled()
    expect(localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled()
  })

  it('never keeps the token: not in the store, localStorage or sessionStorage', async () => {
    useVoiceSession.getState().setInputVolume(80) // writes the prefs to localStorage too

    const result = await startJoin(voice)

    expect(result).toEqual({ outcome: 'joined' })
    expect(JSON.stringify(useVoiceSession.getState())).not.toContain('token-1')
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const contents = Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`)
      expect(contents.join('\n')).not.toContain('token-1')
      expect(contents.join('\n')).not.toMatch(/token/i)
    }
  })

  it('fetches a new token for every join, including a rejoin of the same channel', async () => {
    await startJoin(voice)
    await useVoiceSession.getState().leave()
    await startJoin(voice)

    expect(tokenRequests.map((request) => request.channelId)).toEqual([voice.id, voice.id])
    expect(fakeLiveKit.FakeRoom.instances[1]!.connect).toHaveBeenCalledWith(
      'wss://livekit.test',
      'token-2',
    )
  })

  it('switching channels disconnects the current room first, with a new token for the next', async () => {
    await startJoin(voice)
    await startJoin(lateNight)

    expect(fakeLiveKit.calls).toEqual([
      'mic',
      'token',
      'connect 0',
      'publish',
      'disconnect 0',
      'mic',
      'token',
      'connect 1',
      'publish',
    ])
    expect(fakeLiveKit.tracks[0]!.stopped).toBe(true)
    expect(fakeLiveKit.FakeRoom.instances[0]!.listenerCount).toBe(0)
    expect(useVoiceSession.getState()).toMatchObject({ status: 'connected', channelId: lateNight.id })
  })

  it('joining the channel you are in does nothing', async () => {
    await startJoin(voice)

    expect(await startJoin(voice)).toEqual({ outcome: 'joined' })

    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(1)
    expect(tokenRequests).toHaveLength(1)
  })
})

describe('join races', () => {
  it('two joins at once (a double click) make one connection', async () => {
    const [first, second] = await Promise.all([startJoin(voice), startJoin(voice)])

    expect([first.outcome, second.outcome].sort()).toEqual(['cancelled', 'joined'])
    expect(fakeLiveKit.calls).toEqual(['mic', 'token', 'connect 0', 'publish'])
    expect(useVoiceSession.getState().status).toBe('connected')
  })

  it('double-clicking Join voice joins once', async () => {
    const { user } = await openVoiceChannel()

    await user.dblClick(screen.getByRole('button', { name: 'Join voice' }))

    expect(await screen.findByText("You're in this channel")).toBeInTheDocument()
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(1)
    expect(fakeLiveKit.createLocalAudioTrack).toHaveBeenCalledTimes(1)
    expect(tokenRequests).toHaveLength(1)
  })

  it('a second join while the first is connecting tears the first down, and the second wins', async () => {
    const connect = deferred()
    fakeLiveKit.FakeRoom.nextConnect = { hold: connect.promise }
    const first = startJoin(voice)
    await vi.waitFor(() => expect(fakeLiveKit.calls).toContain('connect 0'))

    const second = await startJoin(lateNight)
    connect.resolve()

    expect(await first).toEqual({ outcome: 'cancelled' })
    expect(second).toEqual({ outcome: 'joined' })
    const [roomA, roomB] = fakeLiveKit.FakeRoom.instances
    expect(roomA!.disconnect).toHaveBeenCalled()
    expect(roomA!.localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(roomA!.listenerCount).toBe(0)
    expect(fakeLiveKit.tracks[0]!.stopped).toBe(true)
    expect(roomB!.disconnect).not.toHaveBeenCalled()
    expect(fakeLiveKit.tracks[1]!.stopped).toBe(false)
    expect(useVoiceSession.getState()).toMatchObject({ status: 'connected', channelId: lateNight.id })
  })

  it('a second join while the first waits for the mic stops the first mic when it arrives', async () => {
    const mic = deferred()
    fakeLiveKit.nextMic = { hold: mic.promise }
    const first = startJoin(voice)
    await vi.waitFor(() => expect(useVoiceSession.getState().status).toBe('requesting-mic'))

    const second = await startJoin(lateNight)
    mic.resolve()

    expect(await first).toEqual({ outcome: 'cancelled' })
    expect(second).toEqual({ outcome: 'joined' })
    // The late mic from the first join is stopped, never published.
    const late = fakeLiveKit.tracks[1]!
    expect(late.stopped).toBe(true)
    expect(fakeLiveKit.room.localParticipant.publishTrack).toHaveBeenCalledWith(
      fakeLiveKit.tracks[0],
      expect.anything(),
    )
    expect(fakeLiveKit.tracks[0]!.stopped).toBe(false)
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(1)
    expect(useVoiceSession.getState()).toMatchObject({ status: 'connected', channelId: lateNight.id })
  })

  it('leaving while the mic prompt is open stops the mic once granted and never connects', async () => {
    const mic = deferred()
    fakeLiveKit.nextMic = { hold: mic.promise }
    const joining = startJoin(voice)
    await vi.waitFor(() => expect(useVoiceSession.getState().status).toBe('requesting-mic'))

    await useVoiceSession.getState().leave()
    mic.resolve()

    expect(await joining).toEqual({ outcome: 'cancelled' })
    expect(fakeLiveKit.mic.stopped).toBe(true)
    expect(tokenRequests).toHaveLength(0)
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(0)
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
  })

  it('leaving while the token is on its way stops the mic and never connects', async () => {
    const tokens = gateRequests('post', TOKEN_PATH)
    const joining = startJoin(voice)
    await vi.waitFor(() => expect(tokens.waiting).toBe(1))
    expect(useVoiceSession.getState().status).toBe('connecting')

    await useVoiceSession.getState().leave()
    expect(fakeLiveKit.mic.stopped).toBe(true)
    tokens.releaseAll()

    expect(await joining).toEqual({ outcome: 'cancelled' })
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(0)
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
  })

  it('leaving while LiveKit connects disconnects the room, stops the mic, and stays idle', async () => {
    const connect = deferred()
    fakeLiveKit.FakeRoom.nextConnect = { hold: connect.promise }
    const joining = startJoin(voice)
    await vi.waitFor(() => expect(fakeLiveKit.calls).toContain('connect 0'))

    await useVoiceSession.getState().leave()
    connect.resolve()

    expect(await joining).toEqual({ outcome: 'cancelled' })
    expect(fakeLiveKit.room.disconnect).toHaveBeenCalled()
    expect(fakeLiveKit.room.listenerCount).toBe(0)
    expect(fakeLiveKit.room.localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(fakeLiveKit.mic.stopped).toBe(true)
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
  })

  it('joining the channel you are already joining does not start over', async () => {
    const connect = deferred()
    fakeLiveKit.FakeRoom.nextConnect = { hold: connect.promise }
    const first = startJoin(voice)
    await vi.waitFor(() => expect(fakeLiveKit.calls).toContain('connect 0'))

    expect(await startJoin(voice)).toEqual({ outcome: 'joined' })
    connect.resolve()

    expect(await first).toEqual({ outcome: 'joined' })
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(1)
    expect(fakeLiveKit.createLocalAudioTrack).toHaveBeenCalledTimes(1)
  })
})

describe('join progress and connection states', () => {
  it('shows waiting for the mic, then connecting, then connected', async () => {
    const { user } = await openVoiceChannel()
    const mic = deferred()
    fakeLiveKit.nextMic = { hold: mic.promise }
    const tokens = gateRequests('post', TOKEN_PATH)

    await user.click(screen.getByRole('button', { name: 'Join voice' }))

    expect(
      await screen.findByText('Allow microphone access in your browser to join.'),
    ).toBeInTheDocument()
    const bar = screen.getByRole('region', { name: 'Voice connection' })
    expect(within(bar).getByText('Waiting for your mic…')).toBeInTheDocument()

    await act(async () => mic.resolve())
    expect(await within(bar).findByText('Connecting…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join voice' })).not.toBeInTheDocument()

    await act(async () => tokens.releaseAll())
    expect(await within(bar).findByText('Connected')).toBeInTheDocument()
    expect(screen.getByText("You're in this channel")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave voice' })).toBeInTheDocument()
  })

  it.each([
    ['Reconnecting', RoomEvent.Reconnecting],
    ['SignalReconnecting', RoomEvent.SignalReconnecting],
  ])('%s shows reconnecting, and Reconnected returns to connected, both announced', async (_, event) => {
    const { user } = await openVoiceChannel()
    const bar = await joinFromPage(user)

    act(() => fakeLiveKit.room.emit(event))

    expect(within(bar).getByText('Reconnecting…')).toBeInTheDocument()
    expect(useVoiceSession.getState().status).toBe('reconnecting')
    expect(await screen.findByText('Reconnecting to voice…')).toHaveAttribute('aria-live', 'polite')

    act(() => fakeLiveKit.room.emit(RoomEvent.Reconnected))

    expect(within(bar).getByText('Connected')).toBeInTheDocument()
    expect(await screen.findByText('Reconnected to voice.')).toHaveAttribute('aria-live', 'polite')
  })

  it.each([
    ['NotAllowedError'],
    ['PermissionDeniedError'],
  ])('a blocked mic (%s) shows how to unblock it, with a retry that joins', async (name) => {
    const { user } = await openVoiceChannel()
    fakeLiveKit.nextMic = { error: new DOMException('Permission denied', name) }

    await user.click(screen.getByRole('button', { name: 'Join voice' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Hideout can't use your microphone")
    expect(alert).toHaveTextContent(micUnblockSteps())
    expect(tokenRequests).toHaveLength(0)
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(0)
    expect(voiceBar()).not.toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({ status: 'mic-denied', channelId: voice.id })

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText("You're in this channel")).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['NotFoundError', VOICE_MESSAGES.noMic],
    ['DevicesNotFoundError', VOICE_MESSAGES.noMic],
    ['NotReadableError', VOICE_MESSAGES.micInUse],
    ['AbortError', VOICE_MESSAGES.micFailed],
  ])('a mic failure (%s) explains it: "%s"', async (name, message) => {
    const { user } = await openVoiceChannel()
    fakeLiveKit.nextMic = { error: new DOMException('No mic', name) }

    await user.click(screen.getByRole('button', { name: 'Join voice' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Not connected to voice')
    expect(alert).toHaveTextContent(message)
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(tokenRequests).toHaveLength(0)
  })

  it('the mic being blocked mid-call ends voice with the unblock steps', async () => {
    const { user } = await openVoiceChannel()
    await joinFromPage(user)
    const { room, mic } = fakeLiveKit

    act(() =>
      room.emit(
        RoomEvent.MediaDevicesError,
        new DOMException('Permission denied', 'NotAllowedError'),
        'audioinput',
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent("Hideout can't use your microphone")
    expect(voiceBar()).not.toBeInTheDocument()
    expect(room.disconnect).toHaveBeenCalled()
    expect(mic.stopped).toBe(true)
  })

  it('other mid-call device errors toast but keep you connected; camera errors are ignored', async () => {
    const { user } = await openVoiceChannel()
    const bar = await joinFromPage(user)

    act(() =>
      fakeLiveKit.room.emit(
        RoomEvent.MediaDevicesError,
        new DOMException('Denied', 'NotAllowedError'),
        'videoinput',
      ),
    )
    act(() =>
      fakeLiveKit.room.emit(
        RoomEvent.MediaDevicesError,
        new DOMException('Gone', 'NotReadableError'),
        'audioinput',
      ),
    )

    expect(await screen.findByText(VOICE_MESSAGES.micFailed)).toBeInTheDocument()
    expect(within(bar).getByText('Connected')).toBeInTheDocument()
    expect(fakeLiveKit.room.disconnect).not.toHaveBeenCalled()
  })

  it('a refused connect says to try in a minute; Try again joins with a new token', async () => {
    const { user } = await openVoiceChannel()
    fakeLiveKit.FakeRoom.nextConnect = { error: new Error('could not establish signal connection') }

    await user.click(screen.getByRole('button', { name: 'Join voice' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(VOICE_MESSAGES.connectFailed)
    expect(fakeLiveKit.FakeRoom.instances[0]!.disconnect).toHaveBeenCalled()
    expect(fakeLiveKit.tracks[0]!.stopped).toBe(true)
    expect(voiceBar()).not.toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText("You're in this channel")).toBeInTheDocument()
    expect(fakeLiveKit.FakeRoom.instances[1]!.connect).toHaveBeenCalledWith(
      'wss://livekit.test',
      'token-2',
    )
  })

  it('a failed connect that emits Disconnected first still reports the join failure, not a lost call', async () => {
    await openVoiceChannel()
    fakeLiveKit.FakeRoom.nextConnect = {
      error: new Error('join failed'),
      disconnectReason: DisconnectReason.JOIN_FAILURE,
    }

    const result = await act(() => startJoin(voice))

    expect(result.outcome).toBe('failed')
    expect(await screen.findByRole('alert')).toHaveTextContent(VOICE_MESSAGES.connectFailed)
    expect(screen.queryByText(VOICE_MESSAGES.lost)).not.toBeInTheDocument()
    expect(useVoiceSession.getState()).toMatchObject({ status: 'disconnected', channelId: voice.id })
  })

  it('a failed publish ends the join with the mic error and disconnects', async () => {
    await openVoiceChannel()
    const connect = deferred()
    fakeLiveKit.FakeRoom.nextConnect = { hold: connect.promise }
    let joining!: ReturnType<typeof startJoin>
    await act(async () => {
      joining = startJoin(voice)
      await vi.waitFor(() => expect(fakeLiveKit.calls).toContain('connect 0'))
    })
    fakeLiveKit.room.localParticipant.publishTrack.mockRejectedValueOnce(new Error('publish failed'))

    const result = await act(async () => {
      connect.resolve()
      return joining
    })

    expect(result.outcome).toBe('failed')
    expect(await screen.findByRole('alert')).toHaveTextContent(VOICE_MESSAGES.micFailed)
    expect(fakeLiveKit.room.disconnect).toHaveBeenCalled()
    expect(fakeLiveKit.mic.stopped).toBe(true)
  })
})

describe('token errors', () => {
  it.each([
    ['409 CHANNEL_NOT_VOICE', tokenError(409, 'CHANNEL_NOT_VOICE'), VOICE_MESSAGES.notVoice],
    ['429 RATE_LIMITED', tokenError(429, 'RATE_LIMITED'), VOICE_MESSAGES.rateLimited],
    ['500', tokenError(500, 'INTERNAL'), VOICE_MESSAGES.joinFailed],
    ['a network failure', () => HttpResponse.error(), VOICE_MESSAGES.offline],
  ])('%s: explains it, stops the mic, never connects, and offers a retry', async (_, respond, message) => {
    server.use(tokenHandler(respond))
    const { user } = await openVoiceChannel()

    await user.click(screen.getByRole('button', { name: 'Join voice' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(fakeLiveKit.mic.stopped).toBe(true)
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(0)

    server.use(tokenHandler())
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText("You're in this channel")).toBeInTheDocument()
  })

  it('404 with the room still there: the channel is gone, so the room is refetched and drops it', async () => {
    server.use(tokenHandler(tokenError(404, 'NOT_FOUND')))
    const { user } = await openVoiceChannel('general')
    const withoutVoice = {
      ...nightOwls,
      channels: nightOwls.channels.filter((channel) => channel.id !== voice.id),
    }
    server.use(roomDetailHandler([withoutVoice]))
    const nav = screen.getByRole('navigation', { name: 'Channels' })

    await user.click(within(nav).getByRole('link', { name: 'voice' }))

    await vi.waitFor(() =>
      expect(within(nav).queryByRole('link', { name: 'voice' })).not.toBeInTheDocument(),
    )
    expect(fakeLiveKit.FakeRoom.instances).toHaveLength(0)
    expect(fakeLiveKit.mic.stopped).toBe(true)
  })

  it('404 and the room 404s too: takes the room-gone path and leaves voice', async () => {
    server.use(tokenHandler(tokenError(404, 'NOT_FOUND')))
    const { user, router } = await openVoiceChannel()
    server.use(http.get(`*/api/rooms/${nightOwls.room.id}`, () => roomNotFound()))

    await user.click(screen.getByRole('button', { name: 'Join voice' }))

    expect(await screen.findByText(isolated("You're no longer in Night Owls."))).toBeInTheDocument()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
  })

  it('401: ends quietly (the session-expiry path signs out)', async () => {
    server.use(tokenHandler(tokenError(401, 'UNAUTHENTICATED')))
    const { user, router } = await openVoiceChannel()
    server.use(http.get('*/api/auth/me', () => new HttpResponse(null, { status: 401 })))

    await user.click(screen.getByRole('button', { name: 'Join voice' }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    expect(useVoiceSession.getState()).toMatchObject({ status: 'idle', channelId: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fakeLiveKit.mic.stopped).toBe(true)
  })
})
