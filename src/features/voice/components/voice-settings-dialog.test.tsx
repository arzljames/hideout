import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeDevice, fakeLiveKit } from '@/test/fake-livekit'
import { server } from '@/test/msw/server'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { renderRoute } from '@/test/render'
import { setVoiceConnected } from '@/test/voice'
import { useVoiceSession } from '../voice-session'

failOnConsoleError()

// jsdom has no setSinkId; Chromium does, which is what enables the output picker.
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', {
    configurable: true,
    value: () => Promise.resolve(),
  })
})
afterAll(() => {
  delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId
})

async function openSettings() {
  const user = userEvent.setup()
  setVoiceConnected(nightOwls, channelOf(nightOwls, 'voice'))
  await renderRoute(roomPath(nightOwls, 'general'))
  const trigger = screen.getByRole('button', { name: 'Voice settings' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Voice settings' })
  return { user, trigger, dialog }
}

describe('VoiceSettingsDialog', () => {
  it("opens from the voice bar's settings button with a description", async () => {
    const { dialog } = await openSettings()

    expect(dialog).toHaveAccessibleDescription(
      'Choose your microphone and speakers, input volume and how your mic opens.',
    )
  })

  it('changes the input device', async () => {
    const { user, dialog } = await openSettings()

    const input = within(dialog).getByRole('combobox', { name: 'Input device' })
    expect(input).toHaveTextContent('System default microphone')

    await user.click(input)
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getAllByRole('option')).toHaveLength(4)
    await user.click(within(listbox).getByRole('option', { name: 'Headset mic' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveTextContent('Headset mic')
    // Closing the select keeps the dialog open.
    expect(screen.getByRole('dialog', { name: 'Voice settings' })).toBeInTheDocument()
  })

  it('changes the output device', async () => {
    const { user, dialog } = await openSettings()

    const output = within(dialog).getByRole('combobox', { name: 'Output device' })
    expect(output).toHaveTextContent('System default speakers')

    await user.click(output)
    await user.click(await screen.findByRole('option', { name: 'Monitor speakers' }))

    expect(output).toHaveTextContent('Monitor speakers')
  })

  it('keeps the chosen devices after closing and reopening', async () => {
    const { user, trigger, dialog } = await openSettings()

    await user.click(within(dialog).getByRole('combobox', { name: 'Input device' }))
    await user.click(await screen.findByRole('option', { name: 'USB condenser mic' }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await user.click(trigger)

    const reopened = await screen.findByRole('dialog', { name: 'Voice settings' })
    expect(within(reopened).getByRole('combobox', { name: 'Input device' })).toHaveTextContent(
      'USB condenser mic',
    )
  })

  it('adjusts input volume with the arrow keys and shows the new percentage', async () => {
    const { user, dialog } = await openSettings()

    const slider = within(dialog).getByRole('slider', { name: 'Input volume' })
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    expect(slider).toHaveAttribute('aria-valuetext', '100%')
    expect(within(dialog).getByText('100%')).toBeInTheDocument()

    // Clicking the slider in jsdom jumps to 0 (no layout), so focus it directly.
    act(() => slider.focus())
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')

    expect(slider).toHaveAttribute('aria-valuetext', '97%')
    expect(within(dialog).getByText('97%')).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')

    expect(slider).toHaveAttribute('aria-valuenow', '98')
    expect(within(dialog).getByText('98%')).toBeInTheDocument()
  })

  it('stops the volume at 100% and 0%', async () => {
    const { user, dialog } = await openSettings()

    const slider = within(dialog).getByRole('slider', { name: 'Input volume' })
    act(() => slider.focus())
    await user.keyboard('{End}{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuetext', '100%')

    await user.keyboard('{Home}{ArrowLeft}')
    expect(slider).toHaveAttribute('aria-valuetext', '0%')
  })

  it('shows the push-to-talk key only in push-to-talk mode, and captures a new key', async () => {
    const { user, dialog } = await openSettings()

    const modes = within(dialog).getByRole('radiogroup', { name: 'Input mode' })
    expect(within(modes).getByRole('radio', { name: /Voice activity/ })).toBeChecked()
    expect(within(dialog).queryByRole('region', { name: 'Push-to-talk key' })).not.toBeInTheDocument()

    await user.click(within(modes).getByRole('radio', { name: /Push to talk/ }))

    const panel = within(dialog).getByRole('region', { name: 'Push-to-talk key' })
    expect(panel).toHaveTextContent('`')
    await user.click(within(panel).getByRole('button', { name: 'Change key' }))
    // Esc cancels the capture, not the dialog.
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Voice settings' })).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Change key' }))
    expect(within(panel).getByRole('button', { name: 'Press a key…' })).toBeInTheDocument()
    await user.keyboard('v')
    expect(panel).toHaveTextContent('V')
    expect(useVoiceSession.getState().pttKey).toBe('KeyV')

    await user.click(within(modes).getByRole('radio', { name: /Voice activity/ }))
    expect(within(dialog).queryByRole('region', { name: 'Push-to-talk key' })).not.toBeInTheDocument()
  })

  it('closes on Done and returns focus to the settings button', async () => {
    const { user, trigger, dialog } = await openSettings()

    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog', { name: 'Voice settings' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on Escape and returns focus to the settings button', async () => {
    const { user, trigger } = await openSettings()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Voice settings' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('describes the volume slider with the mic test caption', async () => {
    const { dialog } = await openSettings()

    expect(within(dialog).getByRole('slider', { name: 'Input volume' })).toHaveAccessibleDescription(
      'Talk to test your mic. The bar lights up when Hideout hears you.',
    )
  })

  it('lists the mute and deafen shortcuts with Ctrl off Apple platforms', async () => {
    const { dialog } = await openSettings()

    const shortcuts = within(dialog).getByText('Shortcuts:').closest('p')
    expect(shortcuts).toHaveTextContent('Mute Ctrl+Shift+M')
    expect(shortcuts).toHaveTextContent('Deafen Ctrl+Shift+D')
  })

  it('shows ⌘ for the shortcuts on macOS', async () => {
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    try {
      const { dialog } = await openSettings()

      const shortcuts = within(dialog).getByText('Shortcuts:').closest('p')
      expect(shortcuts).toHaveTextContent('⌘')
      expect(shortcuts).not.toHaveTextContent('Ctrl')
    } finally {
      platform.mockRestore()
    }
  })
})

const PREFS_KEY = 'hideout.voice-prefs'

function savedPrefs(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>
}

/** Open the dialog while really in voice (the fake LiveKit room behind it). */
async function openSettingsInVoice() {
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
  const user = userEvent.setup()
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
  const trigger = screen.getByRole('button', { name: 'Voice settings' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Voice settings' })
  return { user, trigger, dialog }
}

describe('VoiceSettingsDialog: devices', () => {
  let mediaDevices: EventTarget

  beforeEach(() => {
    mediaDevices = new EventTarget()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: mediaDevices })
  })
  afterEach(() => {
    delete (navigator as { mediaDevices?: unknown }).mediaDevices
  })

  it('lists devices without asking for mic permission', async () => {
    await openSettings()

    expect(fakeLiveKit.FakeRoom.getLocalDevices).toHaveBeenCalledWith('audioinput', false)
    expect(fakeLiveKit.FakeRoom.getLocalDevices).toHaveBeenCalledWith('audiooutput', false)
  })

  it('refreshes the lists when a device is plugged in, and stops listening once closed', async () => {
    const { user, dialog } = await openSettings()
    fakeLiveKit.devices = {
      ...fakeLiveKit.devices,
      audioinput: [
        ...fakeLiveKit.devices.audioinput,
        fakeDevice('audioinput', 'new-mic', 'Podcast mic'),
      ],
    }

    await act(async () => {
      mediaDevices.dispatchEvent(new Event('devicechange'))
    })
    await user.click(within(dialog).getByRole('combobox', { name: 'Input device' }))

    expect(await screen.findByRole('option', { name: 'Podcast mic' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Voice settings' })).not.toBeInTheDocument()
    const calls = fakeLiveKit.FakeRoom.getLocalDevices.mock.calls.length
    mediaDevices.dispatchEvent(new Event('devicechange'))
    expect(fakeLiveKit.FakeRoom.getLocalDevices).toHaveBeenCalledTimes(calls)
  })

  it('names unlabelled devices (no mic permission yet) by number', async () => {
    fakeLiveKit.devices = {
      audioinput: [fakeDevice('audioinput', 'a', ''), fakeDevice('audioinput', 'b', '')],
      audiooutput: [],
    }
    const { user, dialog } = await openSettings()

    await user.click(within(dialog).getByRole('combobox', { name: 'Input device' }))

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'System default microphone',
      'Microphone 1',
      'Microphone 2',
    ])
  })

  it('shows the system default when the saved mic is no longer plugged in', async () => {
    useVoiceSession.setState({ inputDevice: 'unplugged-mic' })
    const { dialog } = await openSettings()

    expect(within(dialog).getByRole('combobox', { name: 'Input device' })).toHaveTextContent(
      'System default microphone',
    )
  })

  it('keeps the system defaults when devices cannot be listed', async () => {
    fakeLiveKit.FakeRoom.getLocalDevices.mockRejectedValueOnce(new Error('insecure context'))
    const { user, dialog } = await openSettings()

    await user.click(within(dialog).getByRole('combobox', { name: 'Input device' }))

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'System default microphone',
    ])
  })

  it('picking a mic in a call switches the live mic and saves the choice', async () => {
    const { user, dialog } = await openSettingsInVoice()

    await user.click(within(dialog).getByRole('combobox', { name: 'Input device' }))
    await user.click(await screen.findByRole('option', { name: 'USB condenser mic' }))

    expect(fakeLiveKit.room.switchActiveDevice).toHaveBeenCalledWith('audioinput', 'usb-mic')
    expect(savedPrefs().inputDevice).toBe('usb-mic')
  })

  it('picking speakers in a call switches output and saves the choice', async () => {
    const { user, dialog } = await openSettingsInVoice()

    await user.click(within(dialog).getByRole('combobox', { name: 'Output device' }))
    await user.click(await screen.findByRole('option', { name: 'Monitor speakers' }))

    expect(fakeLiveKit.room.switchActiveDevice).toHaveBeenCalledWith('audiooutput', 'monitor')
    expect(savedPrefs().outputDevice).toBe('monitor')
  })

  it('the input volume slider saves the level', async () => {
    const { user, dialog } = await openSettingsInVoice()
    const slider = within(dialog).getByRole('slider', { name: 'Input volume' })

    act(() => slider.focus())
    await user.keyboard('{PageDown}')

    expect(useVoiceSession.getState().inputVolume).toBe(90)
    expect(savedPrefs().inputVolume).toBe(90)
  })

  it('measures the mic only while open, and releases the analyser on close', async () => {
    const { user } = await openSettingsInVoice()

    await vi.waitFor(() => expect(fakeLiveKit.analysers).toHaveLength(1))
    expect(fakeLiveKit.createAudioAnalyser).toHaveBeenCalledWith(fakeLiveKit.mic, {
      cloneTrack: true,
    })

    await user.keyboard('{Escape}')

    await vi.waitFor(() => expect(fakeLiveKit.analysers[0]!.cleanup).toHaveBeenCalled())
  })
})

describe('VoiceSettingsDialog: browsers without speaker selection', () => {
  let setSinkId: PropertyDescriptor | undefined

  beforeEach(() => {
    setSinkId = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'setSinkId')
    delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId
  })
  afterEach(() => {
    if (setSinkId) Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', setSinkId)
  })

  it('disables the output picker and explains why (Firefox, Safari)', async () => {
    const { dialog } = await openSettings()

    const output = within(dialog).getByRole('combobox', { name: 'Output device' })
    expect(output).toBeDisabled()
    expect(output).toHaveAccessibleDescription(
      'This browser plays voice through your system speakers.',
    )
    expect(within(dialog).getByRole('combobox', { name: 'Input device' })).toBeEnabled()
  })
})

describe('VoiceSettingsDialog: push-to-talk key', () => {
  async function startCapture() {
    const opened = await openSettings()
    const modes = within(opened.dialog).getByRole('radiogroup', { name: 'Input mode' })
    await opened.user.click(within(modes).getByRole('radio', { name: /Push to talk/ }))
    const panel = within(opened.dialog).getByRole('region', { name: 'Push-to-talk key' })
    await opened.user.click(within(panel).getByRole('button', { name: 'Change key' }))
    const button = within(panel).getByRole('button', { name: 'Press a key…' })
    return { ...opened, panel, button }
  }

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
    ['NumpadEnter', '[NumpadEnter]'],
  ])('rejects %s (it presses buttons) and keeps waiting', async (_, keys) => {
    const { user, panel, button } = await startCapture()

    await user.keyboard(keys)

    expect(within(panel).getByRole('status')).toHaveTextContent(
      'Enter and Space press buttons. Pick another key.',
    )
    expect(button).toHaveAccessibleName('Press a key…')
    expect(useVoiceSession.getState().pttKey).toBe('Backquote')

    await user.keyboard('[KeyT]')
    expect(useVoiceSession.getState().pttKey).toBe('KeyT')
    expect(within(panel).getByRole('status')).toBeEmptyDOMElement()
  })

  it('Tab moves focus on and cancels the capture', async () => {
    const { user, panel, button } = await startCapture()

    await user.tab()

    expect(button).not.toHaveFocus()
    expect(within(panel).getByRole('button', { name: 'Change key' })).toBeInTheDocument()
    expect(useVoiceSession.getState().pttKey).toBe('Backquote')
  })

  it('Escape cancels the capture without closing the dialog; a second Escape closes it', async () => {
    const { user, panel } = await startCapture()

    await user.keyboard('{Escape}')
    expect(within(panel).getByRole('button', { name: 'Change key' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Voice settings' })).toBeInTheDocument()
    expect(useVoiceSession.getState().pttKey).toBe('Backquote')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Voice settings' })).not.toBeInTheDocument()
  })

  it('pressing the current push-to-talk key while capturing picks it, without talking', async () => {
    const { user } = await startCapture()

    await user.keyboard('[Backquote>]')

    expect(useVoiceSession.getState().pttKey).toBe('Backquote')
    expect(useVoiceSession.getState().pttActive).toBe(false)
    await user.keyboard('[/Backquote]')
  })

  it('saves the mode and key for next time', async () => {
    const { user } = await startCapture()

    await user.keyboard('[KeyG]')

    expect(savedPrefs()).toMatchObject({ inputMode: 'push-to-talk', pttKey: 'KeyG' })
  })

  it('shows the new key in the voice bar', async () => {
    const { user } = await startCapture()

    await user.keyboard('[KeyG]')
    await user.keyboard('{Escape}')

    expect(screen.getByRole('region', { name: 'Voice connection' })).toHaveTextContent(
      'Hold G to talk',
    )
  })
})
