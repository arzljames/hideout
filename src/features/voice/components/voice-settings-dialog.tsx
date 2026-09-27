import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useAudioDevices, type AudioDeviceOption } from '../hooks/use-audio-devices'
import { useMicLevel } from '../hooks/use-mic-level'
import { useVoiceSession } from '../voice-session'
import { InputModePicker } from './input-mode-picker'
import { MicMeter } from './mic-meter'
import { PushToTalkPanel } from './push-to-talk-panel'
import { VoiceShortcuts } from './voice-shortcuts'

interface VoiceSettingsDialogProps {
  /** The trigger, rendered via `DialogTrigger asChild`; must forward its ref. */
  children: ReactNode
  className?: string
}

/** The saved device if it's still plugged in, otherwise the system default. */
function selectedDevice(devices: AudioDeviceOption[], id: string) {
  return devices.some((device) => device.id === id) ? id : 'default'
}

/** Devices, input volume and input mode. Everything is bound to the voice session. */
export function VoiceSettingsDialog({ children, className }: VoiceSettingsDialogProps) {
  const ids = {
    input: useId(),
    output: useId(),
    outputHelp: useId(),
    volume: useId(),
    meterCaption: useId(),
    mode: useId(),
  }
  const [open, setOpen] = useState(false)
  const [capturingKey, setCapturingKey] = useState(false)
  const { inputs, outputs, canChooseOutput } = useAudioDevices(open)
  const level = useMicLevel(open)
  const inVoice = useVoiceSession((s) => s.status === 'connected' || s.status === 'reconnecting')
  const inputDevice = useVoiceSession((s) => s.inputDevice)
  const outputDevice = useVoiceSession((s) => s.outputDevice)
  const inputVolume = useVoiceSession((s) => s.inputVolume)
  const inputMode = useVoiceSession((s) => s.inputMode)
  const setInputDevice = useVoiceSession((s) => s.setInputDevice)
  const setOutputDevice = useVoiceSession((s) => s.setOutputDevice)
  const setInputVolume = useVoiceSession((s) => s.setInputVolume)
  const setInputMode = useVoiceSession((s) => s.setInputMode)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setCapturingKey(false)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={cn('max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg', className)}
        onEscapeKeyDown={(event) => {
          // Esc while waiting for a push-to-talk key cancels that, not the dialog.
          if (!capturingKey) return
          event.preventDefault()
          setCapturingKey(false)
        }}
      >
        <DialogHeader>
          <DialogTitle>Voice settings</DialogTitle>
          <DialogDescription className="sr-only">
            Choose your microphone and speakers, input volume and how your mic opens.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={ids.input}>Input device</FieldLabel>
              <Select
                value={selectedDevice(inputs, inputDevice)}
                onValueChange={(id) => void setInputDevice(id)}
              >
                <SelectTrigger id={ids.input} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inputs.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field data-disabled={!canChooseOutput || undefined}>
              <FieldLabel htmlFor={ids.output}>Output device</FieldLabel>
              <Select
                value={selectedDevice(outputs, outputDevice)}
                onValueChange={(id) => void setOutputDevice(id)}
                disabled={!canChooseOutput}
              >
                <SelectTrigger
                  id={ids.output}
                  className="w-full"
                  aria-describedby={canChooseOutput ? undefined : ids.outputHelp}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {outputs.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChooseOutput && (
                <FieldDescription id={ids.outputHelp}>
                  This browser plays voice through your system speakers.
                </FieldDescription>
              )}
            </Field>
          </div>

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel id={ids.volume}>Input volume</FieldLabel>
              <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
                {inputVolume}%
              </span>
            </div>
            <Slider
              aria-labelledby={ids.volume}
              aria-describedby={ids.meterCaption}
              aria-valuetext={`${inputVolume}%`}
              min={0}
              max={100}
              step={1}
              value={[inputVolume]}
              onValueChange={([next]) => {
                if (next !== undefined) setInputVolume(next)
              }}
            />
            <MicMeter level={level} className="mt-2" />
            <p id={ids.meterCaption} className="text-xs text-muted-foreground">
              {inVoice
                ? 'Talk to test your mic. The bar lights up when Hideout hears you.'
                : 'Join a voice channel to test your mic.'}
            </p>
          </Field>

          <Field>
            <FieldLabel id={ids.mode} asChild>
              <span>Input mode</span>
            </FieldLabel>
            <InputModePicker value={inputMode} onValueChange={setInputMode} labelledBy={ids.mode} />
          </Field>

          {inputMode === 'push-to-talk' && (
            <PushToTalkPanel capturing={capturingKey} onCapturingChange={setCapturingKey} />
          )}

          <VoiceShortcuts />
        </FieldGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
