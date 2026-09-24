// TODO(livekit): replace with Room.getLocalDevices('audioinput' | 'audiooutput').

export interface AudioDeviceOption {
  id: string
  label: string
}

export const sampleInputDevices: AudioDeviceOption[] = [
  { id: 'default', label: 'Default microphone' },
  { id: 'headset-mic', label: 'Headset mic' },
  { id: 'usb-mic', label: 'USB condenser mic' },
  { id: 'webcam-mic', label: 'Webcam microphone' },
]

export const sampleOutputDevices: AudioDeviceOption[] = [
  { id: 'default', label: 'Default speakers' },
  { id: 'headset', label: 'Headset' },
  { id: 'monitor', label: 'Monitor speakers' },
]
