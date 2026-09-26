import { useId } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ROOM_NAME_MAX_LENGTH } from '@/features/rooms'
import { cn } from '@/lib/utils'
import type { OverviewValues } from '../overview-schema'

interface RoomNameFieldProps {
  control: Control<OverviewValues>
  className?: string
}

/** "Room name" input with a counter tied to it (described by, not a live region). */
export function RoomNameField({ control, className }: RoomNameFieldProps) {
  const ids = { input: useId(), counter: useId(), error: useId() }

  return (
    <Controller
      name="name"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn(className)}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={ids.input}>Room name</FieldLabel>
            <span id={ids.counter} className="text-xs text-muted-foreground tabular-nums">
              {field.value.length} / {ROOM_NAME_MAX_LENGTH}{' '}
              <span className="sr-only">characters</span>
            </span>
          </div>
          <Input
            {...field}
            id={ids.input}
            autoComplete="off"
            maxLength={ROOM_NAME_MAX_LENGTH}
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.invalid ? `${ids.error} ${ids.counter}` : ids.counter}
          />
          {fieldState.invalid && <FieldError id={ids.error} errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
