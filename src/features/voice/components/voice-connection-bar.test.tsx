import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionQuality, RoomEvent } from 'livekit-client'
import { http, HttpResponse } from 'msw'
import { fakeLiveKit, FakeRemoteParticipant } from '@/test/fake-livekit'
import { server } from '@/test/msw/server'
import { failOnConsoleError } from '@/test/console-guard'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { renderRoute } from '@/test/render'
import { setVoiceConnected } from '@/test/voice'
import { useVoiceSession } from '../voice-session'

failOnConsoleError()

async function renderBar() {
  const user = userEvent.setup()
  setVoiceConnected(nightOwls, channelOf(nightOwls, 'voice'))
  await renderRoute(roomPath(nightOwls, 'general'))
  const bar = screen.getByRole('region', { name: 'Voice connection' })
  return {
    user,
    bar,
    mute: within(bar).getByRole('button', { name: 'Mute' }),
    deafen: within(bar).getByRole('button', { name: 'Deafen' }),
  }
}

describe('VoiceConnectionBar', () => {
  it('shows progress while joining, and Disconnect leaves voice', async () => {
    const { user, bar } = await renderBar()
    act(() => useVoiceSession.setState({ status: 'reconnecting' }))
    expect(within(bar).getByText('Reconnecting…')).toBeInTheDocument()

    await user.click(within(bar).getByRole('button', { name: 'Disconnect' }))

    expect(useVoiceSession.getState().status).toBe('idle')
    expect(screen.queryByRole('region', { name: 'Voice connection' })).not.toBeInTheDocument()
  })

  it('shows the connection status, channel and room', async () => {
    const { bar } = await renderBar()

    expect(within(bar).getByText('Connected')).toBeInTheDocument()
    expect(bar).toHaveTextContent('voice · Night Owls')
    expect(within(bar).getByText('Good')).toHaveTextContent('Connection quality: Good')
  })

  it('has labelled Voice settings and Disconnect buttons', async () => {
    const { bar } = await renderBar()

    expect(within(bar).getByRole('button', { name: 'Voice settings' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  })

  it('shows on Home too, since the voice session outlives the room page', async () => {
    setVoiceConnected(nightOwls, channelOf(nightOwls, 'voice'))
    await renderRoute('/')

    expect(screen.getByRole('region', { name: 'Voice connection' })).toBeInTheDocument()
  })

  it('renders nothing when not connected', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))

    expect(screen.queryByRole('region', { name: 'Voice connection' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument()
  })

  it('toggles Mute with aria-pressed', async () => {
    const { user, mute } = await renderBar()
    expect(mute).toHaveAttribute('aria-pressed', 'false')

    await user.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles Mute from the keyboard', async () => {
    const { user, mute } = await renderBar()

    act(() => mute.focus())
    await user.keyboard('{Enter}')
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard(' ')
    expect(mute).toHaveAttribute('aria-pressed', 'false')
  })

  it('mutes you when you deafen, and unmutes you again when you undeafen', async () => {
    const { user, mute, deafen } = await renderBar()

    await user.click(deafen)
    expect(deafen).toHaveAttribute('aria-pressed', 'true')
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.click(deafen)
    expect(deafen).toHaveAttribute('aria-pressed', 'false')
    expect(mute).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps you muted after undeafening if you were muted before deafening', async () => {
    const { user, mute, deafen } = await renderBar()

    await user.click(mute)
    await user.click(deafen)
    await user.click(deafen)

    expect(deafen).toHaveAttribute('aria-pressed', 'false')
    expect(mute).toHaveAttribute('aria-pressed', 'true')
  })

  it('undeafens when you unmute while deafened', async () => {
    const { user, mute, deafen } = await renderBar()

    await user.click(deafen)
    await user.click(mute)

    expect(mute).toHaveAttribute('aria-pressed', 'false')
    expect(deafen).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('VoiceConnectionBar: live state', () => {
  async function joinForReal() {
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
    await renderRoute(roomPath(nightOwls, 'general'))
    const voice = channelOf(nightOwls, 'voice')
    await act(() =>
      useVoiceSession.getState().join({
        roomId: nightOwls.room.id,
        roomName: nightOwls.room.name,
        channelId: voice.id,
        channelName: voice.name,
      }),
    )
    return screen.getByRole('region', { name: 'Voice connection' })
  }

  it.each([
    [ConnectionQuality.Excellent, 'Good'],
    [ConnectionQuality.Good, 'Good'],
    [ConnectionQuality.Poor, 'Poor'],
    [ConnectionQuality.Lost, 'Lost'],
  ])('shows your connection quality from LiveKit (%s → %s)', async (quality, label) => {
    const bar = await joinForReal()
    const { room } = fakeLiveKit

    act(() => room.emit(RoomEvent.ConnectionQualityChanged, quality, room.localParticipant))

    expect(within(bar).getByText(label)).toHaveTextContent(`Connection quality: ${label}`)
  })

  it("ignores other people's connection quality", async () => {
    const bar = await joinForReal()
    const { room } = fakeLiveKit
    act(() => room.emit(RoomEvent.ConnectionQualityChanged, ConnectionQuality.Good, room.localParticipant))

    act(() =>
      room.emit(RoomEvent.ConnectionQualityChanged, ConnectionQuality.Lost, new FakeRemoteParticipant('maya')),
    )

    expect(within(bar).getByText('Good')).toBeInTheDocument()
  })

  it('hides the quality while reconnecting', async () => {
    const bar = await joinForReal()
    const { room } = fakeLiveKit
    act(() => room.emit(RoomEvent.ConnectionQualityChanged, ConnectionQuality.Poor, room.localParticipant))

    act(() => room.emit(RoomEvent.Reconnecting))

    expect(within(bar).queryByText('Poor')).not.toBeInTheDocument()
  })
})

describe('VoiceConnectionBar: push-to-talk hint', () => {
  it('shows "Hold <key> to talk" in push-to-talk mode, and hides it while muted', async () => {
    useVoiceSession.setState({ inputMode: 'push-to-talk', pttKey: 'KeyF' })
    const { user, bar, mute } = await renderBar()

    expect(bar).toHaveTextContent('Hold F to talk')
    await user.click(mute)
    expect(bar).not.toHaveTextContent('to talk')
  })

  it('has no hint in voice activity mode', async () => {
    const { bar } = await renderBar()

    expect(bar).not.toHaveTextContent('to talk')
  })

  it('says it is waiting for your mic while the browser prompt is open', async () => {
    const { bar } = await renderBar()

    act(() => useVoiceSession.setState({ status: 'requesting-mic' }))

    expect(within(bar).getByText('Waiting for your mic…')).toBeInTheDocument()
  })
})
