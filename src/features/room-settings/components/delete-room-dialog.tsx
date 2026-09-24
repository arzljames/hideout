import { Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
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

interface DeleteRoomDialogProps {
  roomName: string
}

/**
 * "Delete room" button and its confirmation. The destructive action stays disabled until the
 * room name is typed exactly (Enter in the field confirms only then); the input clears
 * whenever the dialog closes.
 */
export function DeleteRoomDialog({ roomName }: DeleteRoomDialogProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const matches = confirmation === roomName

  function handleOpenChange(next: boolean) {
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
            // TODO(api): delete the room, then navigate Home and toast.
            if (matches) handleOpenChange(false)
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive-solid" disabled={!matches}>
              Delete room
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
