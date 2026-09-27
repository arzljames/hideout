import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeLiveKit } from '@/test/fake-livekit'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import type { VoiceInputMode } from '../voice-prefs'
import { useVoiceSession } from '../voice-session'

failOnConsoleError()

const voice = channelOf(nightOwls, 'voice')

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

async function renderGeneral() {
  const user = userEvent.setup()
  const view = await renderRoute(roomPath(nightOwls, 'general'))
  return { user, ...view }
}

/** On #general, in the voice channel, with `mode`. Resolves once the mic is published. */
async function inVoice(mode: VoiceInputMode = 'push-to-talk') {
  useVoiceSession.getState().setInputMode(mode)
  const view = await renderGeneral()
  await act(() =>
    useVoiceSession.getState().join({
      roomId: nightOwls.room.id,
      roomName: nightOwls.room.name,
      channelId: voice.id,
      channelName: voice.name,
    }),
  )
  const bar = screen.getByRole('region', { name: 'Voice connection' })
  return { ...view, mic: fakeLiveKit.mic, bar }
}

/** Whether the published mic is open (LiveKit track unmuted). */
async function expectMicOpen(open: boolean) {
  await vi.waitFor(() => expect(fakeLiveKit.mic.isMuted).toBe(!open))
}

/** A keydown on `target`; false when the handler called preventDefault. */
function keyDown(target: Element | Window | Document, init: KeyboardEventInit) {
  let result = true
  act(() => {
    result = fireEvent.keyDown(target, init)
  })
  return result
}

function keyUp(target: Element | Window | Document, init: KeyboardEventInit) {
  act(() => {
    fireEvent.keyUp(target, init)
  })
}

const BACKQUOTE = { code: 'Backquote', key: '`' }

describe('push to talk', () => {
  it('publishes the mic closed; holding the key opens it and releasing closes it', async () => {
    const { user, bar } = await inVoice()
    await expectMicOpen(false)
    expect(bar).toHaveTextContent('Hold ` to talk')

    await user.keyboard('[Backquote>]')
    await expectMicOpen(true)
    expect(useVoiceSession.getState().pttActive).toBe(true)

    await user.keyboard('[/Backquote]')
    await expectMicOpen(false)
    expect(useVoiceSession.getState().pttActive).toBe(false)
  })

  it('a stray auto-repeat keydown never reopens the mic after release', async () => {
    await inVoice()
    keyDown(window, BACKQUOTE)
    keyUp(window, BACKQUOTE)
    await expectMicOpen(false)

    keyDown(window, { ...BACKQUOTE, repeat: true })

    await expectMicOpen(false)
    expect(useVoiceSession.getState().pttActive).toBe(false)
  })

  it('ignores the key with Ctrl, Alt or Meta held', async () => {
    await inVoice()

    for (const modifier of ['ctrlKey', 'altKey', 'metaKey'] as const) {
      keyDown(window, { ...BACKQUOTE, [modifier]: true })
    }

    expect(useVoiceSession.getState().pttActive).toBe(false)
    await expectMicOpen(false)
  })

  it('typing the key in the message composer types it, and never opens the mic', async () => {
    const { user } = await inVoice()
    const composer = screen.getByRole('textbox', { name: 'Message #general' })

    await user.click(composer)
    await user.keyboard('a{`>}')

    expect(useVoiceSession.getState().pttActive).toBe(false)
    await expectMicOpen(false)
    await user.keyboard('{/`}b')
    expect(composer).toHaveValue('a`b')
  })

  it.each([
    ['an input', () => document.createElement('input')],
    ['a textarea', () => document.createElement('textarea')],
    ['a select', () => document.createElement('select')],
    [
      'a contenteditable',
      () => {
        const editor = document.createElement('div')
        editor.setAttribute('contenteditable', 'true')
        editor.append(document.createElement('span'))
        return editor
      },
    ],
  ])('ignores the key typed into %s', async (_, create) => {
    await inVoice()
    const field = create()
    document.body.append(field)
    try {
      const target = field.firstElementChild ?? field

      expect(keyDown(target, BACKQUOTE)).toBe(true)

      expect(useVoiceSession.getState().pttActive).toBe(false)
    } finally {
      field.remove()
    }
  })

  it('on a focused button or link, talks but leaves the key to the control (no preventDefault)', async () => {
    const { bar } = await inVoice()
    const mute = within(bar).getByRole('button', { name: 'Mute' })
    const link = within(screen.getByRole('navigation', { name: 'Channels' })).getByRole('link', {
      name: 'clips',
    })

    expect(keyDown(mute, BACKQUOTE)).toBe(true)
    await expectMicOpen(true)
    keyUp(mute, BACKQUOTE)
    await expectMicOpen(false)

    expect(keyDown(link, BACKQUOTE)).toBe(true)
    await expectMicOpen(true)
    keyUp(link, BACKQUOTE)
  })

  it('elsewhere on the page the key is consumed (preventDefault) while talking', async () => {
    await inVoice()

    expect(keyDown(document.body, BACKQUOTE)).toBe(false)

    await expectMicOpen(true)
  })

  it('leaving the window closes the mic while the key is held', async () => {
    await inVoice()
    keyDown(window, BACKQUOTE)
    await expectMicOpen(true)

    act(() => {
      fireEvent.blur(window)
    })

    await expectMicOpen(false)
    expect(useVoiceSession.getState().pttActive).toBe(false)
  })

  it('hiding the tab closes the mic while the key is held', async () => {
    await inVoice()
    keyDown(window, BACKQUOTE)
    await expectMicOpen(true)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      await expectMicOpen(false)
    } finally {
      visibility.mockRestore()
    }
  })

  it('becoming visible again does not open the mic', async () => {
    await inVoice()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(useVoiceSession.getState().pttActive).toBe(false)
    } finally {
      visibility.mockRestore()
    }
  })

  it('holding the key while muted or deafened keeps the mic closed', async () => {
    const { user } = await inVoice()
    act(() => useVoiceSession.getState().toggleMute())

    await user.keyboard('[Backquote>]')
    await expectMicOpen(false)
    await user.keyboard('[/Backquote]')

    act(() => useVoiceSession.getState().toggleDeafen())
    await user.keyboard('[Backquote>]')
    await expectMicOpen(false)
    await user.keyboard('[/Backquote]')
  })

  it('uses a custom key, and the old one stops working', async () => {
    const { user, bar } = await inVoice()
    act(() => useVoiceSession.getState().setPttKey('KeyV'))
    expect(bar).toHaveTextContent('Hold V to talk')

    await user.keyboard('[Backquote>]')
    expect(useVoiceSession.getState().pttActive).toBe(false)
    await user.keyboard('[/Backquote]')

    await user.keyboard('[KeyV>]')
    await expectMicOpen(true)
    await user.keyboard('[/KeyV]')
    await expectMicOpen(false)
  })

  it('does nothing outside voice', async () => {
    useVoiceSession.getState().setInputMode('push-to-talk')
    await renderGeneral()

    expect(keyDown(document.body, BACKQUOTE)).toBe(true)

    expect(useVoiceSession.getState().pttActive).toBe(false)
  })

  it('leaving voice while holding the key releases it', async () => {
    const { user } = await inVoice()
    await user.keyboard('[Backquote>]')
    expect(useVoiceSession.getState().pttActive).toBe(true)

    await act(() => useVoiceSession.getState().leave())

    expect(useVoiceSession.getState().pttActive).toBe(false)
    await user.keyboard('[/Backquote]')
  })

  it('switching modes in a call: voice activity opens the mic, push to talk closes it', async () => {
    const { user } = await inVoice('voice-activity')
    await expectMicOpen(true)

    act(() => useVoiceSession.getState().setInputMode('push-to-talk'))
    await expectMicOpen(false)
    await user.keyboard('[Backquote>]')
    await expectMicOpen(true)

    // Switching away mid-press drops the press; the key does nothing in voice activity.
    act(() => useVoiceSession.getState().setInputMode('voice-activity'))
    expect(useVoiceSession.getState().pttActive).toBe(false)
    await expectMicOpen(true)
    await user.keyboard('[/Backquote]')
    await expectMicOpen(true)
  })
})

describe('mute and deafen shortcuts', () => {
  it('Ctrl+Shift+M toggles mute and Ctrl+Shift+D toggles deafen while in voice', async () => {
    const { user, bar } = await inVoice('voice-activity')
    const mute = within(bar).getByRole('button', { name: 'Mute' })
    const deafen = within(bar).getByRole('button', { name: 'Deafen' })

    await user.keyboard('{Control>}{Shift>}M{/Shift}{/Control}')
    expect(mute).toHaveAttribute('aria-pressed', 'true')
    await expectMicOpen(false)

    await user.keyboard('{Control>}{Shift>}M{/Shift}{/Control}')
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    await expectMicOpen(true)

    await user.keyboard('{Control>}{Shift>}D{/Shift}{/Control}')
    expect(deafen).toHaveAttribute('aria-pressed', 'true')
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('{Control>}{Shift>}D{/Shift}{/Control}')
    expect(deafen).toHaveAttribute('aria-pressed', 'false')
  })

  it('takes over the browser shortcut (preventDefault) only while in voice', async () => {
    await renderGeneral()
    const shortcut = { code: 'KeyM', key: 'M', ctrlKey: true, shiftKey: true }

    expect(keyDown(document.body, shortcut)).toBe(true)
    expect(useVoiceSession.getState().muted).toBe(false)
  })

  it('consumes the shortcut while in voice', async () => {
    await inVoice('voice-activity')

    expect(keyDown(document.body, { code: 'KeyM', key: 'M', ctrlKey: true, shiftKey: true })).toBe(
      false,
    )
    expect(useVoiceSession.getState().muted).toBe(true)
  })

  it('ignores repeats, Alt, missing Shift and keys typed in the composer', async () => {
    const { user } = await inVoice('voice-activity')

    keyDown(document.body, { code: 'KeyM', ctrlKey: true, shiftKey: true, repeat: true })
    keyDown(document.body, { code: 'KeyM', ctrlKey: true, shiftKey: true, altKey: true })
    keyDown(document.body, { code: 'KeyM', ctrlKey: true })
    await user.click(screen.getByRole('textbox', { name: 'Message #general' }))
    await user.keyboard('{Control>}{Shift>}M{/Shift}{/Control}')

    expect(useVoiceSession.getState()).toMatchObject({ muted: false, deafened: false })
  })

  it('uses ⌘ instead of Ctrl on Apple platforms', async () => {
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    try {
      const { user } = await inVoice('voice-activity')

      await user.keyboard('{Control>}{Shift>}M{/Shift}{/Control}')
      expect(useVoiceSession.getState().muted).toBe(false)

      await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}')
      expect(useVoiceSession.getState().muted).toBe(true)
    } finally {
      platform.mockRestore()
    }
  })
})
