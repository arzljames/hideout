import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import type { Channel } from '@/features/rooms'
import { useDeleteChannel } from '../api'
import { CHANNEL_MESSAGES, channelErrorMessage } from '../channel-errors'
import { useChannelErrorEffects } from '../hooks/use-channel-error-effects'

const FALLBACK_MESSAGE = "Couldn't delete the channel. Try again."

interface DeleteChannelDialogProps {
  roomId: string
  channel: Channel
  /** It's the room's only text channel: explain why it can't go, and disable Delete. */
  isLastTextChannel: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Focus target on close (the control that opened it, or a fallback once the row is gone). */
  returnFocus: () => HTMLElement | null
}

/**
 * Confirm deleting a channel. Cancel gets initial focus (AlertDialog default). The dialog stays
 * open while the delete is in flight, and on failure with the reason, so it can be retried.
 * Give it a new `key` per open so an earlier failure isn't shown again.
 */
export function DeleteChannelDialog({
  roomId,
  channel,
  isLastTextChannel,
  open,
  onOpenChange,
  returnFocus,
}: DeleteChannelDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const errorEffects = useChannelErrorEffects(roomId)
  const deleteChannel = useDeleteChannel(roomId, channel)
  const pending = deleteChannel.isPending
  const blocked = isLastTextChannel ? CHANNEL_MESSAGES.lastTextChannel : null
  const message = error ?? blocked

  function handleOpenChange(next: boolean) {
    if (!next && deleteChannel.isPending) return
    onOpenChange(next)
  }

  function handleDelete() {
    if (pending || blocked) return
    setError(null)
    deleteChannel.mutate(undefined, {
      onSuccess: () => onOpenChange(false),
      onError: async (failure) => {
        const outcome = await errorEffects(failure)
        if (outcome === 'room-gone') return
        if (outcome === 'forbidden') {
          toast.error(CHANNEL_MESSAGES.forbidden)
          onOpenChange(false)
          return
        }
        setError(channelErrorMessage(failure, FALLBACK_MESSAGE))
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
            Delete #<bdi>{channel.name}</bdi>?
          </AlertDialogTitle>
          <AlertDialogDescription>Messages in it are deleted too.</AlertDialogDescription>
        </AlertDialogHeader>

        {message && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: the dialog stays open while the delete is
              in flight, and on failure so the user can retry. */}
          <Button
            type="button"
            variant="destructive-solid"
            disabled={pending || blocked !== null}
            onClick={handleDelete}
          >
            {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
            Delete channel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
