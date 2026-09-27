import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
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
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sameRoomId, type Member } from '@/features/rooms'
import { useTransferOwnership } from '../api'
import { memberErrorMessage, memberErrorOutcome } from '../member-errors'

const FALLBACK_MESSAGE = "Couldn't transfer ownership. Try again."

interface TransferOwnershipDialogProps {
  roomId: string
  roomName: string
  /** Transfer to this member (opened from their menu). Without it, pick from `candidates`. */
  member?: Member
  /** Everyone who could become the owner (every member but you). */
  candidates?: Member[]
  /**
   * You're still the owner. When this turns false while no transfer is in flight (ownership
   * moved elsewhere), the dialog closes. Defaults to true (the caller unmounts it instead).
   */
  isOwner?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Focus target on close; without it (or once it's gone) the dialog's default applies. */
  returnFocus?: () => HTMLElement | null
}

/**
 * Confirm making another member the owner (owner only; you become an admin). Opened for one
 * member, or with a Select of the other members (Danger zone). Cancel gets initial focus. The
 * dialog stays open while the request is in flight, and on failure with the reason; after a
 * 5xx the room has been refetched first, so a retry sees whether it applied.
 */
export function TransferOwnershipDialog({
  roomId,
  roomName,
  member,
  candidates = [],
  isOwner = true,
  open,
  onOpenChange,
  returnFocus,
}: TransferOwnershipDialogProps) {
  const selectId = useId()
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const transfer = useTransferOwnership(roomId)
  const pending = transfer.isPending
  const target =
    member ?? candidates.find((candidate) => sameRoomId(candidate.user.id, selectedId))

  // Not while pending: a successful transfer demotes us and closes via its own onSuccess.
  useEffect(() => {
    if (!isOwner && open && !pending) onOpenChange(false)
  }, [isOwner, open, pending, onOpenChange])

  function handleOpenChange(next: boolean) {
    if (!next && pending) return
    onOpenChange(next)
    if (!next) {
      setSelectedId('')
      setError(null)
    }
  }

  function handleTransfer() {
    if (pending || !target) return
    setError(null)
    const name = target.user.displayName
    transfer.mutate(target, {
      onSuccess: () => onOpenChange(false),
      onError: (failure) => {
        const outcome = memberErrorOutcome(failure)
        if (outcome === 'room-gone') return
        if (outcome === 'forbidden') {
          onOpenChange(false) // Toasted by the mutation.
          return
        }
        setError(memberErrorMessage(failure, FALLBACK_MESSAGE, name))
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const focusTarget = returnFocus?.()
          if (!focusTarget?.isConnected) return
          event.preventDefault()
          focusTarget.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {member ? (
              <>
                Make <bdi>{member.user.displayName}</bdi> the owner?
              </>
            ) : (
              <>
                Transfer ownership of <bdi>{roomName}</bdi>?
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll become an admin and lose owner-only controls, like deleting the room.
            Only the new owner can give ownership back.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!member && (
          <Field>
            <FieldLabel htmlFor={selectId}>New owner</FieldLabel>
            <Select value={selectedId} onValueChange={setSelectedId} disabled={pending}>
              <SelectTrigger id={selectId} className="w-full">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.user.id} value={candidate.user.id}>
                    <bdi>{candidate.user.displayName}</bdi>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: stays open while pending and on failure. */}
          <Button
            type="button"
            variant="destructive-solid"
            disabled={pending || !target}
            onClick={handleTransfer}
          >
            {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
            Transfer ownership
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
