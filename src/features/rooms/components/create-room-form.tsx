import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useId } from 'react'
import { Controller, useFormState, useWatch, type UseFormReturn } from 'react-hook-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ROOM_NAME_MAX_LENGTH, type CreateRoomValues } from '../create-room-schema'
import { RoomEmojiPicker } from './room-emoji-picker'

interface CreateRoomFormProps {
  form: UseFormReturn<CreateRoomValues>
  onSubmit: (values: CreateRoomValues) => void
  /** The create request is in flight: submit is disabled and shows a spinner. */
  pending?: boolean
  className?: string
}

/** Name + icon fields and the dialog footer. The form state is owned by `CreateRoomDialog`. */
export function CreateRoomForm({ form, onSubmit, pending = false, className }: CreateRoomFormProps) {
  const ids = {
    name: useId(),
    counter: useId(),
    nameError: useId(),
    iconTitle: useId(),
    iconHelp: useId(),
    iconError: useId(),
  }
  const name = useWatch({ control: form.control, name: 'name' })
  const { errors } = useFormState({ control: form.control })
  const formError = errors.root?.server?.message

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className={cn('flex flex-col gap-6', className)}
    >
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={ids.name}>Room name</FieldLabel>
                {/* Read with the input via aria-describedby; deliberately not a live region. */}
                <span id={ids.counter} className="text-xs text-muted-foreground tabular-nums">
                  {name.length}/{ROOM_NAME_MAX_LENGTH}{' '}
                  <span className="sr-only">characters</span>
                </span>
              </div>
              <Input
                {...field}
                id={ids.name}
                placeholder="Night Owls"
                autoComplete="off"
                maxLength={ROOM_NAME_MAX_LENGTH}
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? `${ids.nameError} ${ids.counter}` : ids.counter
                }
              />
              {fieldState.invalid && <FieldError id={ids.nameError} errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="emoji"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field
              data-invalid={fieldState.invalid}
              aria-labelledby={ids.iconTitle}
              aria-describedby={fieldState.invalid ? `${ids.iconError} ${ids.iconHelp}` : ids.iconHelp}
            >
              <div className="flex items-center justify-between gap-2">
                <FieldTitle id={ids.iconTitle}>Icon</FieldTitle>
                <span id={ids.iconHelp} className="text-xs text-muted-foreground">
                  Pick an emoji or upload an image
                </span>
              </div>
              <RoomEmojiPicker value={field.value} onValueChange={field.onChange} />
              {fieldState.invalid && <FieldError id={ids.iconError} errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      {formError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
          Create room
        </Button>
      </DialogFooter>
    </form>
  )
}
