import type { RefObject } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface RemoveMemberDialogProps {
  memberName: string
  roomName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opened from a menu item, so focus goes back to the menu's trigger on close. */
  returnFocusRef: RefObject<HTMLElement | null>
}

/** Confirm removing someone from the room. */
export function RemoveMemberDialog({
  memberName,
  roomName,
  open,
  onOpenChange,
  returnFocusRef,
}: RemoveMemberDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current
          if (target?.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {memberName} from {roomName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll lose access to every channel. They can rejoin with a new invite.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* TODO(api): remove member mutation; toast; invalidate members. */}
          <AlertDialogAction variant="destructive-solid">Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
