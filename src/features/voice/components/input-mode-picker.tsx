import { useId } from 'react'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import type { VoiceInputMode } from '../voice-store'

const MODES: { value: VoiceInputMode; title: string; description: string }[] = [
  { value: 'voice-activity', title: 'Voice activity', description: 'Your mic opens when you talk.' },
  {
    value: 'push-to-talk',
    title: 'Push to talk',
    description: 'Your mic opens while you hold a key.',
  },
]

function isInputMode(value: string): value is VoiceInputMode {
  return MODES.some((mode) => mode.value === value)
}

interface InputModePickerProps {
  value: VoiceInputMode
  onValueChange: (value: VoiceInputMode) => void
  /** id of the visible "Input mode" label. */
  labelledBy: string
  className?: string
}

/** Choice cards for voice activity vs. push to talk (shadcn Field "choice card" pattern). */
export function InputModePicker({ value, onValueChange, labelledBy, className }: InputModePickerProps) {
  const idPrefix = useId()

  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={(next) => {
        if (isInputMode(next)) onValueChange(next)
      }}
      className={cn('grid-cols-1 sm:grid-cols-2', className)}
    >
      {MODES.map((mode) => {
        const id = `${idPrefix}-${mode.value}`
        return (
          <FieldLabel key={mode.value} htmlFor={id}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{mode.title}</FieldTitle>
                <FieldDescription>{mode.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem id={id} value={mode.value} />
            </Field>
          </FieldLabel>
        )
      })}
    </RadioGroup>
  )
}
