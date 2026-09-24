import { initialVoiceState, resetVoiceStore, useVoiceStore } from './voice-store'

// setup.ts resets the store after each test; these tests start from initialVoiceState.
const state = () => useVoiceStore.getState()

describe('voice store', () => {
  it('starts connected to Night Owls voice, unmuted and undeafened, in push-to-talk', () => {
    expect(state().connection).toMatchObject({
      status: 'connected',
      roomName: 'Night Owls',
      channelName: 'voice',
    })
    expect(state().muted).toBe(false)
    expect(state().deafened).toBe(false)
    expect(state().inputMode).toBe('push-to-talk')
    expect(state().inputVolume).toBe(80)
  })

  it('toggles mute', () => {
    state().toggleMute()
    expect(state().muted).toBe(true)
    state().toggleMute()
    expect(state().muted).toBe(false)
  })

  it('mutes when deafening', () => {
    state().toggleDeafen()

    expect(state()).toMatchObject({ deafened: true, muted: true })
  })

  it('restores unmuted when undeafening if you were unmuted before', () => {
    state().toggleDeafen()
    state().toggleDeafen()

    expect(state()).toMatchObject({ deafened: false, muted: false })
  })

  it('stays muted when undeafening if you were muted before', () => {
    state().toggleMute()
    state().toggleDeafen()
    state().toggleDeafen()

    expect(state()).toMatchObject({ deafened: false, muted: true })
  })

  it('unmuting while deafened also undeafens', () => {
    state().toggleDeafen()
    state().toggleMute()

    expect(state()).toMatchObject({ deafened: false, muted: false })
  })

  it('remembers the latest pre-deafen mute state across cycles', () => {
    state().toggleMute() // muted
    state().toggleDeafen() // deafened, remembers muted
    state().toggleDeafen() // muted again
    state().toggleMute() // unmuted
    state().toggleDeafen() // deafened, remembers unmuted
    state().toggleDeafen()

    expect(state()).toMatchObject({ deafened: false, muted: false })
  })

  it.each([
    [50, 50],
    [0, 0],
    [100, 100],
    [-5, 0],
    [140, 100],
  ])('clamps input volume %i to %i', (input, expected) => {
    state().setInputVolume(input)
    expect(state().inputVolume).toBe(expected)
  })

  it('sets input mode and devices', () => {
    state().setInputMode('voice-activity')
    state().setInputDevice('usb-mic')
    state().setOutputDevice('headset')

    expect(state()).toMatchObject({
      inputMode: 'voice-activity',
      inputDevice: 'usb-mic',
      outputDevice: 'headset',
    })
  })

  it('resets to the initial state', () => {
    state().toggleDeafen()
    state().setInputVolume(10)
    state().setInputMode('voice-activity')

    resetVoiceStore()

    expect(state()).toMatchObject(initialVoiceState)
  })
})
