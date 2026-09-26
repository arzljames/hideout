import { Hash, Volume2, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ChannelType } from '@/features/rooms'
import { cn } from '@/lib/utils'

const TYPES = [
  { value: 'text', title: 'Text', description: 'Messages, links and clips.', Icon: Hash },
  { value: 'voice', title: 'Voice', description: 'Hang out and talk.', Icon: Volume2 },
] as const satisfies readonly { value: ChannelType; title: string; description: string; Icon: LucideIcon }[]

function isChannelType(value: string): value is ChannelType {
  return TYPES.some((type) => type.value === value)
}

interface ChannelTypePickerProps {
  value: ChannelType
  onValueChange: (value: ChannelType) => void
  /** id of the visible "Channel type" label. */
  labelledBy: string
  disabled?: boolean
  className?: string
}

/** Text / Voice choice cards (shadcn Field "choice card" pattern). */
export function ChannelTypePicker({
  value,
  onValueChange,
  labelledBy,
  disabled,
  className,
}: ChannelTypePickerProps) {
  const idPrefix = useId()

  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (isChannelType(next)) onValueChange(next)
      }}
      className={cn('grid-cols-1 sm:grid-cols-2', className)}
    >
      {TYPES.map(({ value: type, title, description, Icon }) => {
        const id = `${idPrefix}-${type}`
        return (
          <FieldLabel key={type} htmlFor={id}>
            <Field orientation="horizontal">
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
              <FieldContent>
                <FieldTitle>{title}</FieldTitle>
                <FieldDescription>{description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem id={id} value={type} />
            </Field>
          </FieldLabel>
        )
      })}
    </RadioGroup>
  )
}
