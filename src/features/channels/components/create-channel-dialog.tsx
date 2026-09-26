import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Field, FieldGroup, FieldTitle } from '@/components/ui/field'
import type { Channel, ChannelType } from '@/features/rooms'
import { isolate } from '@/lib/bidi'
import { cn } from '@/lib/utils'
import { useCreateChannel } from '../api'
import { CHANNEL_MESSAGES, channelErrorMessage, setChannelFieldErrors } from '../channel-errors'
import { createChannelFormSchema, type CreateChannelValues } from '../channel-name-schema'
import { useChannelErrorEffects } from '../hooks/use-channel-error-effects'
import { ChannelNameField } from './channel-name-field'
import { ChannelTypePicker } from './channel-type-picker'

const FALLBACK_MESSAGE = "Couldn't create the channel. Try again."

interface CreateChannelDialogProps {
  roomId: string
  /** The room's channels, to catch a taken name before the API does. */
  channels: readonly Channel[]
  /** Preselected type (the group whose "+" opened it). */
  defaultType: ChannelType
  /** Open a new text channel after creating it (default true). See `useCreateChannel`. */
  openTextChannel?: boolean
  /** The trigger, rendered via `DialogTrigger asChild`. Must forward its ref. */
  children: ReactNode
  className?: string
}

/**
 * "Create a channel" dialog: type (Text/Voice) and name. Each trigger owns its own instance, so
 * focus returns to it on close, unless a new text channel opens (its heading gets focus).
 */
export function CreateChannelDialog({
  roomId,
  channels,
  defaultType,
  openTextChannel = true,
  children,
  className,
}: CreateChannelDialogProps) {
  const typeTitleId = useId()
  const [open, setOpen] = useState(false)
  // Set before the hook navigates to a new text channel, so focus isn't returned to the trigger.
  const opened = useRef(false)
  // Set synchronously on submit: validation is async, so a double click (or Enter twice) could
  // submit twice before `isPending` disables the button. Creating a channel isn't idempotent.
  const submitting = useRef(false)
  const errorEffects = useChannelErrorEffects(roomId)
  const createChannel = useCreateChannel(roomId, {
    openTextChannel,
    onCreated: (_channel, opening) => {
      opened.current = opening
    },
  })

  const schema = useMemo(
    () =>
      createChannelFormSchema({
        text: channels.filter((channel) => channel.type === 'text').map((channel) => channel.name),
        voice: channels.filter((channel) => channel.type === 'voice').map((channel) => channel.name),
      }),
    [channels],
  )
  const defaults: CreateChannelValues = { type: defaultType, name: '' }
  const form = useForm<CreateChannelValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })
  const formError = form.formState.errors.root?.server?.message
  const pending = createChannel.isPending

  function handleOpenChange(next: boolean) {
    // Not while the channel is being created: the request can't be taken back.
    if (!next && createChannel.isPending) return
    setOpen(next)
    // Every open starts fresh, with the type of the group it was opened from.
    form.reset(defaults)
    createChannel.reset()
  }

  function handleSubmit(values: CreateChannelValues) {
    if (submitting.current) return
    submitting.current = true
    form.clearErrors('root')
    createChannel.mutate(
      { type: values.type, name: values.name },
      {
        onSettled: () => {
          submitting.current = false
        },
        // Runs after the hook has cached the channel (and opened it, for text).
        onSuccess: (channel) => {
          if (!opened.current) toast.success(`Created #${isolate(channel.name)}`)
          setOpen(false)
          form.reset(defaults)
          createChannel.reset()
        },
        onError: async (error) => {
          if (setChannelFieldErrors(form.setError, error)) return
          const outcome = await errorEffects(error)
          if (outcome === 'room-gone') return
          if (outcome === 'forbidden') {
            // The room is refetched and the create controls go away with the old role.
            toast.error(CHANNEL_MESSAGES.forbidden)
            setOpen(false)
            return
          }
          form.setError('root.server', {
            type: 'server',
            message: channelErrorMessage(error, FALLBACK_MESSAGE),
          })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={cn('sm:max-w-md', className)}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          form.setFocus('name')
        }}
        onCloseAutoFocus={(event) => {
          if (!opened.current) return
          // The new channel is opening: useCreateChannel focuses its heading.
          opened.current = false
          event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>Everyone in the room can see it.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <Controller
              name="type"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldTitle id={typeTitleId}>Channel type</FieldTitle>
                  <ChannelTypePicker
                    value={field.value}
                    onValueChange={field.onChange}
                    labelledBy={typeTitleId}
                    disabled={pending}
                  />
                </Field>
              )}
            />
            <ChannelNameField control={form.control} />
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
              Create channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
