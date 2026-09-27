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
import { ApiError } from '@/lib/api/client'
import { useDeleteMessage } from '../api'
import { MESSAGE_ERRORS, messageWriteErrorMessage } from '../message-errors'
import type { Message } from '../types'

interface DeleteMessageDialogProps {
  roomId: string
  channelId: string
  message: Message
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Focus target on close (the row is gone after a delete, so the caller picks a neighbour). */
  returnFocus: () => HTMLElement | null
}

/**
 * Confirm deleting a message. Cancel gets initial focus (AlertDialog default). The message is
 * removed at once; the dialog stays open while the delete is in flight, and on failure (the
 * message is back) with the reason, so it can be retried. Give it a new `key` per open.
 */
export function DeleteMessageDialog({
  roomId,
  channelId,
  message,
  open,
  onOpenChange,
  returnFocus,
}: DeleteMessageDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const deleteMessage = useDeleteMessage(roomId, channelId)
  const pending = deleteMessage.isPending

  function handleOpenChange(next: boolean) {
    if (!next && pending) return
    onOpenChange(next)
  }

  function handleDelete() {
    if (pending) return
    setError(null)
    deleteMessage.mutate(message, {
      onSuccess: () => onOpenChange(false),
      onError: (failure) => {
        if (failure instanceof ApiError && failure.status === 403) {
          toast.error(MESSAGE_ERRORS.deleteForbidden)
          onOpenChange(false)
          return
        }
        setError(messageWriteErrorMessage(failure, MESSAGE_ERRORS.deleteFailed))
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
          <AlertDialogTitle>Delete this message?</AlertDialogTitle>
          <AlertDialogDescription>
            It's removed for everyone in the channel. This can't be undone.
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
          {/* Not AlertDialogAction: the dialog stays open while the delete is in flight. */}
          <Button
            type="button"
            variant="destructive-solid"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
            Delete message
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
