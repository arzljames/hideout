import { LoaderCircle, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useDeleteRoom } from '@/features/rooms'

interface DeleteRoomDialogProps {
  roomId: string
  roomName: string
}

/**
 * "Delete room" button and its confirmation. The destructive action stays disabled until the
 * room name is typed exactly (Enter in the field confirms only then); the input clears
 * whenever the dialog closes. While the delete is in flight the dialog stays open; on success
 * useDeleteRoom goes Home.
 */
export function DeleteRoomDialog({ roomId, roomName }: DeleteRoomDialogProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const matches = confirmation === roomName
  const deleteRoom = useDeleteRoom(roomId)

  function handleOpenChange(next: boolean) {
    if (!next && deleteRoom.isPending) return
    setOpen(next)
    if (!next) setConfirmation('')
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive-solid">
          <Trash2 aria-hidden="true" />
          Delete room
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          // Start in the confirmation field rather than on Cancel.
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {roomName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes every channel and message for everyone. It can&apos;t be undone. Only
            the owner can do this.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* A form so Enter in the field confirms, but only once the name matches. */}
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (matches && !deleteRoom.isPending) deleteRoom.mutate()
          }}
        >
          <Field>
            <FieldLabel htmlFor={inputId}>Type {roomName} to confirm</FieldLabel>
            <Input
              ref={inputRef}
              id={inputId}
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRoom.isPending}>Cancel</AlertDialogCancel>
            {/* A plain submit button, not AlertDialogAction: the dialog stays open while the
                delete is in flight, and on failure (toasted) so the user can retry. */}
            <Button
              type="submit"
              variant="destructive-solid"
              disabled={!matches || deleteRoom.isPending}
            >
              {deleteRoom.isPending && (
                <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
              )}
              Delete room
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
