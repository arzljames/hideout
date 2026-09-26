import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { useCreateRoom } from '../api'
import { createRoomDefaults, createRoomSchema, type CreateRoomValues } from '../create-room-schema'
import { roomFormErrorMessage, setRoomFieldErrors } from '../room-form-errors'
import { CreateRoomForm } from './create-room-form'

const RATE_LIMITED_MESSAGE = "You've created several rooms recently. Try again later."
const FALLBACK_MESSAGE = "Couldn't create the room. Try again."

interface CreateRoomDialogProps {
  /** The trigger, rendered via `DialogTrigger asChild`. Must be a single element that forwards its ref. */
  children: ReactNode
  className?: string
}

/**
 * "Create a room" dialog. Each trigger owns its own instance, so focus returns to it on close.
 * After a successful create the new room opens and focus moves to its channel heading instead.
 */
export function CreateRoomDialog({ children, className }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false)
  const created = useRef(false)
  // Set synchronously on submit: validation is async, so a double click (or Enter twice) can
  // submit twice before `isPending` disables the button. Creating a room isn't idempotent.
  const submitting = useRef(false)
  // Set before the hook navigates to the new room (and then focuses its heading). On Home the
  // dialog unmounts early (the empty state becomes the room list), on the rail it closes;
  // either way onCloseAutoFocus must not send focus back to the trigger.
  const createRoom = useCreateRoom({
    onCreated: () => {
      created.current = true
    },
  })
  const form = useForm<CreateRoomValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: createRoomDefaults,
  })

  function handleOpenChange(next: boolean) {
    // Not while the room is being created: the request can't be taken back.
    if (!next && createRoom.isPending) return
    setOpen(next)
    // Cancel, Esc, X and overlay clicks all start fresh next time.
    if (!next) {
      form.reset(createRoomDefaults)
      createRoom.reset()
    }
  }

  function handleSubmit(values: CreateRoomValues) {
    if (submitting.current) return
    submitting.current = true
    form.clearErrors('root')
    createRoom.mutate(
      { name: values.name, icon: { kind: 'emoji', emoji: values.emoji } },
      {
        onSettled: () => {
          submitting.current = false
        },
        // Runs after the hook has cached the room and navigated to it.
        onSuccess: () => {
          setOpen(false)
          form.reset(createRoomDefaults)
          createRoom.reset()
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 422) {
            if (setRoomFieldErrors(form.setError, error)) return
          }
          const message =
            error instanceof ApiError && error.status === 429
              ? RATE_LIMITED_MESSAGE
              : roomFormErrorMessage(error, FALLBACK_MESSAGE)
          form.setError('root.server', { type: 'server', message })
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
          // Land on the name input rather than the first focusable Radix picks.
          event.preventDefault()
          form.setFocus('name')
        }}
        onCloseAutoFocus={(event) => {
          if (!created.current) return
          // The new room is opening: useCreateRoom focuses its heading, not the trigger.
          created.current = false
          event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create a room</DialogTitle>
          <DialogDescription>Only people you invite can see it or join.</DialogDescription>
        </DialogHeader>
        <CreateRoomForm form={form} onSubmit={handleSubmit} pending={createRoom.isPending} />
      </DialogContent>
    </Dialog>
  )
}
