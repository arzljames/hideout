import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useLeaveRoom } from '../api'
import { memberErrorMessage, memberErrorOutcome } from '../member-errors'

const FALLBACK_MESSAGE = "Couldn't leave the room. Try again."

interface LeaveRoomDialogProps {
  roomId: string
  roomName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opened from a menu item, so focus goes back to the menu's trigger on close. */
  returnFocusRef: RefObject<HTMLElement | null>
}

/**
 * Confirm leaving the room (admins and members). Cancel gets initial focus. On success
 * useLeaveRoom goes Home and toasts; on failure (e.g. 409 OWNER_PROTECTED) the dialog stays
 * open with the reason.
 */
export function LeaveRoomDialog({
  roomId,
  roomName,
  open,
  onOpenChange,
  returnFocusRef,
}: LeaveRoomDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const leave = useLeaveRoom(roomId)
  const pending = leave.isPending

  function handleOpenChange(next: boolean) {
    if (!next && pending) return
    onOpenChange(next)
    if (!next) setError(null)
  }

  function handleLeave() {
    if (pending) return
    setError(null)
    leave.mutate(undefined, {
      onError: (failure) => {
        const outcome = memberErrorOutcome(failure)
        if (outcome === 'room-gone') return
        if (outcome === 'forbidden') {
          onOpenChange(false) // Toasted by the mutation.
          return
        }
        setError(memberErrorMessage(failure, FALLBACK_MESSAGE))
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current
          if (!target?.isConnected) return
          event.preventDefault()
          target.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Leave <bdi>{roomName}</bdi>?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll lose access to its channels. You can come back with a new invite.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive-solid" disabled={pending} onClick={handleLeave}>
            {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
            Leave room
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
