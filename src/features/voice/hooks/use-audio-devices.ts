import { useEffect, useState } from 'react'

export interface AudioDeviceOption {
  id: string
  label: string
}

export interface AudioDevices {
  inputs: AudioDeviceOption[]
  outputs: AudioDeviceOption[]
  /** The browser lets pages pick speakers (setSinkId; not Firefox or Safari today). */
  canChooseOutput: boolean
}

const DEFAULT_INPUT: AudioDeviceOption = { id: 'default', label: 'System default microphone' }
const DEFAULT_OUTPUT: AudioDeviceOption = { id: 'default', label: 'System default speakers' }

/** 'default' and 'communications' are aliases for a real device already in the list. */
function toOptions(devices: MediaDeviceInfo[], fallback: string): AudioDeviceOption[] {
  return devices
    .filter((device) => device.deviceId && !['default', 'communications'].includes(device.deviceId))
    .map((device, index) => ({
      id: device.deviceId,
      // Labels are empty until the site has mic permission.
      label: device.label || `${fallback} ${index + 1}`,
    }))
}

function supportsOutputSelection(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
}

/**
 * Microphones and speakers (LiveKit's Room.getLocalDevices, without prompting for permission),
 * refreshed when devices change. Only listens while `active` (e.g. the settings dialog is open).
 */
export function useAudioDevices(active: boolean): AudioDevices {
  const [devices, setDevices] = useState<Omit<AudioDevices, 'canChooseOutput'>>({
    inputs: [DEFAULT_INPUT],
    outputs: [DEFAULT_OUTPUT],
  })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const refresh = async () => {
      try {
        const { Room } = await import('livekit-client')
        const [inputs, outputs] = await Promise.all([
          Room.getLocalDevices('audioinput', false),
          Room.getLocalDevices('audiooutput', false),
        ])
        if (cancelled) return
        setDevices({
          inputs: [DEFAULT_INPUT, ...toOptions(inputs, 'Microphone')],
          outputs: [DEFAULT_OUTPUT, ...toOptions(outputs, 'Speakers')],
        })
      } catch {
        // No device access (e.g. insecure context): keep the system defaults.
      }
    }
    void refresh()
    const mediaDevices = navigator.mediaDevices as MediaDevices | undefined
    mediaDevices?.addEventListener('devicechange', refresh)
    return () => {
      cancelled = true
      mediaDevices?.removeEventListener('devicechange', refresh)
    }
  }, [active])

  return { ...devices, canChooseOutput: supportsOutputSelection() }
}
