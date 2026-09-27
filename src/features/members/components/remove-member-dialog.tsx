import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
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
import type { Member } from '@/features/rooms'
import { isolate } from '@/lib/bidi'
import { useRemoveMember } from '../api'
import { memberErrorMessage, memberErrorOutcome } from '../member-errors'

interface RemoveMemberDialogProps {
  roomId: string
  roomName: string
  member: Member
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Focus target on close (the control that opened it, or a fallback once the row is gone). */
  returnFocus: () => HTMLElement | null
}

/**
 * Confirm removing someone from the room. Cancel gets initial focus (AlertDialog default). The
 * member leaves the list at once (optimistic); the dialog stays open while the request is in
 * flight, and on failure (the member is back) with the reason, so it can be retried. Give it a
 * new `key` per open.
 */
export function RemoveMemberDialog({
  roomId,
  roomName,
  member,
  open,
  onOpenChange,
  returnFocus,
}: RemoveMemberDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const removeMember = useRemoveMember(roomId)
  const pending = removeMember.isPending
  const name = member.user.displayName

  function handleOpenChange(next: boolean) {
    if (!next && pending) return
    onOpenChange(next)
  }

  function handleRemove() {
    if (pending) return
    setError(null)
    removeMember.mutate(member, {
      onSuccess: () => onOpenChange(false),
      onError: (failure) => {
        const outcome = memberErrorOutcome(failure)
        if (outcome === 'room-gone') return
        if (outcome === 'forbidden') {
          onOpenChange(false) // Toasted by the mutation.
          return
        }
        setError(memberErrorMessage(failure, `Couldn't remove ${isolate(name)}. Try again.`, name))
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const target = returnFocus()
          if (!target?.isConnected) return
          event.preventDefault()
          target.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove <bdi>{name}</bdi> from <bdi>{roomName}</bdi>?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll lose access to every channel. They can rejoin with a new invite.
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
          {/* A plain button, not AlertDialogAction: the dialog stays open while the request is
              in flight, and on failure so the user can retry. */}
          <Button type="button" variant="destructive-solid" disabled={pending} onClick={handleRemove}>
            {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
            Remove
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
