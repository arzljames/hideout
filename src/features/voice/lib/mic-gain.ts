import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client'

/**
 * Input volume for the local mic: a Web Audio gain node between the captured track and what
 * LiveKit publishes, set with LocalAudioTrack.setProcessor. Mute still works: LiveKit mutes by
 * disabling the source track, which silences the processed output too.
 */
export class MicGainProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = 'hideout-mic-gain'
  processedTrack?: MediaStreamTrack
  private gain: number
  private nodes?: {
    source: MediaStreamAudioSourceNode
    gain: GainNode
    destination: MediaStreamAudioDestinationNode
  }

  constructor(gain: number) {
    this.gain = gain
  }

  async init({ track, audioContext }: AudioProcessorOptions): Promise<void> {
    const source = audioContext.createMediaStreamSource(new MediaStream([track]))
    const gain = audioContext.createGain()
    gain.gain.value = this.gain
    const destination = audioContext.createMediaStreamDestination()
    source.connect(gain).connect(destination)
    this.nodes = { source, gain, destination }
    this.processedTrack = destination.stream.getAudioTracks()[0]
  }

  async restart(options: AudioProcessorOptions): Promise<void> {
    await this.destroy()
    await this.init(options)
  }

  async destroy(): Promise<void> {
    this.nodes?.source.disconnect()
    this.nodes?.gain.disconnect()
    this.processedTrack?.stop()
    this.nodes = undefined
    this.processedTrack = undefined
  }

  setGain(gain: number): void {
    this.gain = gain
    if (this.nodes) this.nodes.gain.gain.value = gain
  }
}
