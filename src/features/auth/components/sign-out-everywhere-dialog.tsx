import { LoaderCircle } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { useSignOutEverywhere } from '../api'

interface SignOutEverywhereDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where focus goes on close, since the dialog is opened from a menu item, not a trigger. */
  returnFocusRef?: RefObject<HTMLElement | null>
  className?: string
}

/** Confirms ending every session. Stays open (and locked) until the request settles. */
export function SignOutEverywhereDialog({
  open,
  onOpenChange,
  returnFocusRef,
  className,
}: SignOutEverywhereDialogProps) {
  const signOutEverywhere = useSignOutEverywhere()
  const pending = signOutEverywhere.isPending

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialogContent
        className={cn(className)}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current
          if (target?.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out everywhere?</AlertDialogTitle>
          <AlertDialogDescription>
            This signs you out of Hideout on every device, including this one.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive-solid"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={(event) => {
              // Keep the dialog open until the request settles; success navigates away.
              event.preventDefault()
              signOutEverywhere.mutate()
            }}
          >
            {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
            Sign out everywhere
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
