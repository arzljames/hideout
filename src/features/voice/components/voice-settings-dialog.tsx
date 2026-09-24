import { useId, type ReactNode } from 'react'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { sampleInputDevices, sampleOutputDevices } from '../sample-devices'
import { useVoiceStore } from '../voice-store'
import { InputModePicker } from './input-mode-picker'
import { MicMeter } from './mic-meter'
import { PushToTalkPanel } from './push-to-talk-panel'
import { VoiceShortcuts } from './voice-shortcuts'

interface VoiceSettingsDialogProps {
  /** The trigger, rendered via `DialogTrigger asChild`; must forward its ref. */
  children: ReactNode
  className?: string
}

/** Devices, input volume and input mode. Everything is bound to the voice store. */
export function VoiceSettingsDialog({ children, className }: VoiceSettingsDialogProps) {
  const ids = {
    input: useId(),
    output: useId(),
    volume: useId(),
    meterCaption: useId(),
    mode: useId(),
  }
  const inputDevice = useVoiceStore((s) => s.inputDevice)
  const outputDevice = useVoiceStore((s) => s.outputDevice)
  const inputVolume = useVoiceStore((s) => s.inputVolume)
  const inputMode = useVoiceStore((s) => s.inputMode)
  const setInputDevice = useVoiceStore((s) => s.setInputDevice)
  const setOutputDevice = useVoiceStore((s) => s.setOutputDevice)
  const setInputVolume = useVoiceStore((s) => s.setInputVolume)
  const setInputMode = useVoiceStore((s) => s.setInputMode)

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={cn('max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg', className)}>
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
              <Select value={inputDevice} onValueChange={setInputDevice}>
                <SelectTrigger id={ids.input} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sampleInputDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={ids.output}>Output device</FieldLabel>
              <Select value={outputDevice} onValueChange={setOutputDevice}>
                <SelectTrigger id={ids.output} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sampleOutputDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <MicMeter className="mt-2" />
            <p id={ids.meterCaption} className="text-xs text-muted-foreground">
              Talk to test your mic. The bar lights up when Hideout hears you.
            </p>
          </Field>

          <Field>
            <FieldLabel id={ids.mode} asChild>
              <span>Input mode</span>
            </FieldLabel>
            <InputModePicker value={inputMode} onValueChange={setInputMode} labelledBy={ids.mode} />
          </Field>

          {inputMode === 'push-to-talk' && <PushToTalkPanel />}

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
