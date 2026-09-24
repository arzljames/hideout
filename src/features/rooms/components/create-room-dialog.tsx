import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createRoomDefaults, createRoomSchema, type CreateRoomValues } from '../create-room-schema'
import { CreateRoomForm } from './create-room-form'

interface CreateRoomDialogProps {
  /** The trigger, rendered via `DialogTrigger asChild`. Must be a single element that forwards its ref. */
  children: ReactNode
  className?: string
}

/** "Create a room" dialog. Each trigger owns its own instance, so focus returns to it on close. */
export function CreateRoomDialog({ children, className }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false)
  const form = useForm<CreateRoomValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: createRoomDefaults,
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Cancel, Esc, X and overlay clicks all start fresh next time.
    if (!next) form.reset(createRoomDefaults)
  }

  function handleSubmit(_values: CreateRoomValues) {
    // TODO(api): create room mutation, map 422 to form.setError, navigate to the new room.
    handleOpenChange(false)
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
      >
        <DialogHeader>
          <DialogTitle>Create a room</DialogTitle>
          <DialogDescription>Only people you invite can see it or join.</DialogDescription>
        </DialogHeader>
        <CreateRoomForm form={form} onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  )
}
