import { useId } from 'react'
import { Controller, useWatch, type Control, type FieldPath } from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CHANNEL_NAME_MAX_LENGTH } from '../channel-name-schema'

interface ChannelNameFieldProps<T extends { name: string }> {
  control: Control<T>
  placeholder?: string
  className?: string
}

/** "Channel name" input with a length counter and inline errors, for create and rename. */
export function ChannelNameField<T extends { name: string }>({
  control,
  placeholder = 'new-channel',
  className,
}: ChannelNameFieldProps<T>) {
  const ids = { input: useId(), counter: useId(), error: useId() }
  // The generic keeps callers' own form types; `name` exists on every T.
  const name = 'name' as FieldPath<T>
  const value = useWatch({ control, name })
  const length = typeof value === 'string' ? value.length : 0

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn(className)}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={ids.input}>Channel name</FieldLabel>
            {/* Read with the input via aria-describedby; deliberately not a live region. */}
            <span id={ids.counter} className="text-xs text-muted-foreground tabular-nums">
              {length}/{CHANNEL_NAME_MAX_LENGTH} <span className="sr-only">characters</span>
            </span>
          </div>
          <Input
            {...field}
            value={typeof field.value === 'string' ? field.value : ''}
            id={ids.input}
            placeholder={placeholder}
            autoComplete="off"
            maxLength={CHANNEL_NAME_MAX_LENGTH}
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.invalid ? `${ids.error} ${ids.counter}` : ids.counter}
          />
          {fieldState.invalid && <FieldError id={ids.error} errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
