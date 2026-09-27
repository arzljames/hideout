import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomEvent } from 'livekit-client'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import {
  deferred,
  FakeAudioContext,
  FakeRemoteParticipant,
  FakeRemoteTrack,
  fakeLiveKit,
  stubWebAudio,
} from '@/test/fake-livekit'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { useVoiceSession } from './voice-session'

failOnConsoleError()

const voice = channelOf(nightOwls, 'voice')
const PREFS_KEY = 'hideout.voice-prefs'

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

function join() {
  return useVoiceSession.getState().join({
    roomId: nightOwls.room.id,
    roomName: nightOwls.room.name,
    channelId: voice.id,
    channelName: voice.name,
  })
}

function savedPrefs(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>
}

/** Let the store's fire-and-forget mic and gain updates run. */
async function settle() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

describe('mute and deafen', () => {
  it('mute closes the mic and unmute opens it again', async () => {
    await join()
    const { mic } = fakeLiveKit
    expect(mic.isMuted).toBe(false)

    useVoiceSession.getState().toggleMute()
    await settle()
    expect(mic.isMuted).toBe(true)
    expect(useVoiceSession.getState().muted).toBe(true)

    useVoiceSession.getState().toggleMute()
    await settle()
    expect(mic.isMuted).toBe(false)
  })

  it('joining while muted publishes the mic already muted', async () => {
    useVoiceSession.getState().toggleMute()

    await join()

    const { mic, room } = fakeLiveKit
    expect(mic.isMuted).toBe(true)
    // Muted in place before it was published, so it never went out open.
    expect(mic.mute.mock.invocationCallOrder[0]).toBeLessThan(
      room.localParticipant.publishTrack.mock.invocationCallOrder[0]!,
    )
    expect(mic.unmute).not.toHaveBeenCalled()
  })

  it('deafen silences everyone in the room and mutes you; undeafen restores both', async () => {
    await join()
    const { room, mic } = fakeLiveKit
    const maya = new FakeRemoteParticipant('maya')
    room.remoteParticipants.set('maya', maya)

    useVoiceSession.getState().toggleDeafen()
    await settle()
    expect(maya.setVolume).toHaveBeenLastCalledWith(0)
    expect(mic.isMuted).toBe(true)
    expect(useVoiceSession.getState()).toMatchObject({ deafened: true, muted: true })

    useVoiceSession.getState().toggleDeafen()
    await settle()
    expect(maya.setVolume).toHaveBeenLastCalledWith(1)
    expect(mic.isMuted).toBe(false)
    expect(useVoiceSession.getState()).toMatchObject({ deafened: false, muted: false })
  })

  it('someone joining while you are deafened is silenced too; after undeafen they are heard', async () => {
    await join()
    const { room } = fakeLiveKit
    useVoiceSession.getState().toggleDeafen()

    const jun = new FakeRemoteParticipant('jun')
    room.remoteParticipants.set('jun', jun)
    room.emit(RoomEvent.ParticipantConnected, jun)
    expect(jun.setVolume).toHaveBeenLastCalledWith(0)

    useVoiceSession.getState().toggleDeafen()
    expect(jun.setVolume).toHaveBeenLastCalledWith(1)

    const alex = new FakeRemoteParticipant('alex')
    room.emit(RoomEvent.ParticipantConnected, alex)
    expect(alex.setVolume).not.toHaveBeenCalled()
  })

  it('undeafening keeps you muted if you were muted before deafening', async () => {
    await join()
    const { mic } = fakeLiveKit
    useVoiceSession.getState().toggleMute()
    useVoiceSession.getState().toggleDeafen()
    useVoiceSession.getState().toggleDeafen()
    await settle()

    expect(useVoiceSession.getState()).toMatchObject({ deafened: false, muted: true })
    expect(mic.isMuted).toBe(true)
  })

  it('unmuting while deafened also undeafens (you cannot talk without hearing)', async () => {
    await join()
    const { room, mic } = fakeLiveKit
    const maya = new FakeRemoteParticipant('maya')
    room.remoteParticipants.set('maya', maya)
    useVoiceSession.getState().toggleDeafen()

    useVoiceSession.getState().toggleMute()
    await settle()

    expect(useVoiceSession.getState()).toMatchObject({ deafened: false, muted: false })
    expect(maya.setVolume).toHaveBeenLastCalledWith(1)
    expect(mic.isMuted).toBe(false)
  })

  it('joining while deafened silences the people already there', async () => {
    useVoiceSession.getState().toggleDeafen()
    const connect = deferred()
    fakeLiveKit.FakeRoom.nextConnect = { hold: connect.promise }
    const joining = join()
    await vi.waitFor(() => expect(fakeLiveKit.calls).toContain('connect 0'))
    const maya = new FakeRemoteParticipant('maya')
    fakeLiveKit.room.remoteParticipants.set('maya', maya)

    connect.resolve()
    await joining

    expect(maya.setVolume).toHaveBeenLastCalledWith(0)
    expect(fakeLiveKit.mic.isMuted).toBe(true)
  })

  it('tracks whether the published mic is open from LiveKit mute events', async () => {
    await join()
    const { room } = fakeLiveKit
    const publication = { source: 'microphone' }
    expect(useVoiceSession.getState().micOpen).toBe(true)

    room.emit(RoomEvent.TrackMuted, publication, room.localParticipant)
    expect(useVoiceSession.getState().micOpen).toBe(false)
    room.emit(RoomEvent.TrackUnmuted, publication, room.localParticipant)
    expect(useVoiceSession.getState().micOpen).toBe(true)
    // Someone else's mute says nothing about yours.
    room.emit(RoomEvent.TrackMuted, publication, new FakeRemoteParticipant('maya'))
    expect(useVoiceSession.getState().micOpen).toBe(true)
  })
})

describe('input volume', () => {
  beforeEach(() => stubWebAudio())

  function gainNode() {
    const contexts = FakeAudioContext.instances
    expect(contexts).toHaveLength(1)
    const nodes = contexts[0]!.gainNodes
    expect(nodes).toHaveLength(1)
    return nodes[0]!
  }

  it('at 100% the mic is published untouched: no Web Audio processing', async () => {
    await join()
    await settle()

    expect(FakeAudioContext.instances).toHaveLength(0)
    expect(fakeLiveKit.mic.setProcessor).not.toHaveBeenCalled()
  })

  it('below 100% a gain processor is attached on join, at that level', async () => {
    useVoiceSession.getState().setInputVolume(40)

    await join()

    const { mic } = fakeLiveKit
    await vi.waitFor(() => expect(mic.setProcessor).toHaveBeenCalledTimes(1))
    expect(mic.setAudioContext).toHaveBeenCalledWith(FakeAudioContext.instances[0])
    expect(gainNode().gain.value).toBeCloseTo(0.4)
  })

  it('rapid slider moves attach one processor (no leak) and end at the last value', async () => {
    await join()
    const { mic } = fakeLiveKit

    for (const value of [90, 75, 60, 42]) useVoiceSession.getState().setInputVolume(value)

    await vi.waitFor(() => expect(mic.setProcessor).toHaveBeenCalledTimes(1))
    await settle()
    expect(mic.setProcessor).toHaveBeenCalledTimes(1)
    expect(gainNode().gain.value).toBeCloseTo(0.42)

    useVoiceSession.getState().setInputVolume(10)
    expect(gainNode().gain.value).toBeCloseTo(0.1)
    expect(mic.setProcessor).toHaveBeenCalledTimes(1)
  })

  it('back to 100% keeps the processor attached at unity gain', async () => {
    useVoiceSession.getState().setInputVolume(50)
    await join()
    const { mic } = fakeLiveKit
    await vi.waitFor(() => expect(mic.setProcessor).toHaveBeenCalledTimes(1))

    useVoiceSession.getState().setInputVolume(100)

    expect(gainNode().gain.value).toBe(1)
    expect(mic.setProcessor).toHaveBeenCalledTimes(1)
  })

  it('clamps and rounds the volume, and saves it', () => {
    useVoiceSession.getState().setInputVolume(140)
    expect(useVoiceSession.getState().inputVolume).toBe(100)
    useVoiceSession.getState().setInputVolume(-5)
    expect(useVoiceSession.getState().inputVolume).toBe(0)
    useVoiceSession.getState().setInputVolume(33.6)
    expect(useVoiceSession.getState().inputVolume).toBe(34)
    expect(savedPrefs().inputVolume).toBe(34)
  })

  it('leaving closes the AudioContext; the next join gets a new processor for its new mic', async () => {
    useVoiceSession.getState().setInputVolume(50)
    await join()
    await vi.waitFor(() => expect(fakeLiveKit.mic.setProcessor).toHaveBeenCalled())
    const first = FakeAudioContext.instances[0]!

    await useVoiceSession.getState().leave()
    expect(first.close).toHaveBeenCalled()

    await join()
    await vi.waitFor(() => expect(fakeLiveKit.mic.setProcessor).toHaveBeenCalledTimes(1))
    expect(FakeAudioContext.instances).toHaveLength(2)
    expect(FakeAudioContext.instances[1]!.closed).toBe(false)
  })

  it('without Web Audio the mic keeps working at its natural level', async () => {
    vi.unstubAllGlobals() // jsdom: no AudioContext
    useVoiceSession.getState().setInputVolume(50)

    expect(await join()).toEqual({ outcome: 'joined' })
    await settle()

    expect(useVoiceSession.getState().status).toBe('connected')
    expect(fakeLiveKit.mic.setProcessor).not.toHaveBeenCalled()
  })
})

describe('remote audio', () => {
  it('plays each subscribed audio track through an element, removed on unsubscribe', async () => {
    await join()
    const { room } = fakeLiveKit
    const maya = new FakeRemoteTrack('audio')
    const jun = new FakeRemoteTrack('audio')

    room.emit(RoomEvent.TrackSubscribed, maya)
    room.emit(RoomEvent.TrackSubscribed, jun)
    expect(document.body.querySelectorAll('audio')).toHaveLength(2)

    room.emit(RoomEvent.TrackUnsubscribed, maya)
    expect(document.body.querySelectorAll('audio')).toHaveLength(1)
    expect(jun.elements[0]!.isConnected).toBe(true)
  })

  it('ignores video tracks', async () => {
    await join()
    const video = new FakeRemoteTrack('video')

    fakeLiveKit.room.emit(RoomEvent.TrackSubscribed, video)

    expect(video.attach).not.toHaveBeenCalled()
    expect(document.body.querySelector('video')).toBeNull()
  })

  it('leaving removes every audio element still playing', async () => {
    await join()
    const tracks = [new FakeRemoteTrack('audio'), new FakeRemoteTrack('audio')]
    for (const track of tracks) fakeLiveKit.room.emit(RoomEvent.TrackSubscribed, track)

    await useVoiceSession.getState().leave()

    expect(document.body.querySelectorAll('audio')).toHaveLength(0)
  })

  it('when the browser blocks playback, "Turn on voice audio" resumes it', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    await act(() => join())
    const { room } = fakeLiveKit
    const bar = screen.getByRole('region', { name: 'Voice connection' })
    expect(within(bar).queryByRole('button', { name: 'Turn on voice audio' })).not.toBeInTheDocument()

    act(() => {
      room.canPlaybackAudio = false
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false)
    })
    await user.click(within(bar).getByRole('button', { name: 'Turn on voice audio' }))

    expect(room.startAudio).toHaveBeenCalledTimes(1)
    expect(within(bar).queryByRole('button', { name: 'Turn on voice audio' })).not.toBeInTheDocument()
  })

  it('keeps "Turn on voice audio" when the browser still refuses', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    await act(() => join())
    const { room } = fakeLiveKit
    room.startAudioFails = true
    act(() => {
      room.canPlaybackAudio = false
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false)
    })
    const bar = screen.getByRole('region', { name: 'Voice connection' })

    await user.click(within(bar).getByRole('button', { name: 'Turn on voice audio' }))

    expect(room.startAudio).toHaveBeenCalled()
    expect(within(bar).getByRole('button', { name: 'Turn on voice audio' })).toBeInTheDocument()
  })

  it('shows "Turn on voice audio" right away when playback is blocked at join', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))
    const connect = deferred()
    fakeLiveKit.FakeRoom.nextConnect = { hold: connect.promise }
    await act(async () => {
      const joining = join()
      await vi.waitFor(() => expect(fakeLiveKit.calls).toContain('connect 0'))
      fakeLiveKit.room.canPlaybackAudio = false
      connect.resolve()
      await joining
    })

    expect(screen.getByRole('button', { name: 'Turn on voice audio' })).toBeInTheDocument()
  })
})

describe('devices', () => {
  it('uses the saved speakers for the LiveKit room', async () => {
    useVoiceSession.setState({ outputDevice: 'monitor' })

    await join()

    expect(fakeLiveKit.room.options).toMatchObject({ audioOutput: { deviceId: 'monitor' } })
  })

  it('switching the mic while in voice switches the live track and saves the choice', async () => {
    await join()

    await useVoiceSession.getState().setInputDevice('usb-mic')

    expect(fakeLiveKit.room.switchActiveDevice).toHaveBeenCalledWith('audioinput', 'usb-mic')
    expect(savedPrefs().inputDevice).toBe('usb-mic')
  })

  it('switching speakers while in voice switches output and saves the choice', async () => {
    await join()

    await useVoiceSession.getState().setOutputDevice('headset')

    expect(fakeLiveKit.room.switchActiveDevice).toHaveBeenCalledWith('audiooutput', 'headset')
    expect(savedPrefs().outputDevice).toBe('headset')
  })

  it('choosing a mic outside voice only saves it; the next join uses it', async () => {
    await useVoiceSession.getState().setInputDevice('webcam-mic')
    expect(savedPrefs().inputDevice).toBe('webcam-mic')

    await join()

    expect(fakeLiveKit.createLocalAudioTrack).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'webcam-mic' }),
    )
    expect(fakeLiveKit.room.switchActiveDevice).not.toHaveBeenCalled()
  })

  it('a failed mic switch says so and keeps you connected', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))
    await act(() => join())
    fakeLiveKit.room.switchActiveDevice.mockRejectedValueOnce(new Error('NotReadableError'))

    await act(() => useVoiceSession.getState().setInputDevice('usb-mic'))

    expect(await screen.findByText("Couldn't switch to that microphone.")).toBeInTheDocument()
    expect(useVoiceSession.getState().status).toBe('connected')
  })

  it('a failed speaker switch says so', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))
    await act(() => join())
    fakeLiveKit.room.switchActiveDevice.mockRejectedValueOnce(new Error('NotFoundError'))

    await act(() => useVoiceSession.getState().setOutputDevice('monitor'))

    expect(await screen.findByText("Couldn't switch to those speakers.")).toBeInTheDocument()
  })
})
