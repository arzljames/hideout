import { useIsMutating } from '@tanstack/react-query'
import { ChevronsUpDown, LogOut, MonitorOff } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import { signOutMutationKeys, useSignOut, type Me } from '../api'
import { SignOutEverywhereDialog } from './sign-out-everywhere-dialog'

interface AccountMenuProps {
  user: Me
  className?: string
}

/** Signed-in user's avatar and name, opening account actions (sign out, sign out everywhere). */
export function AccountMenu({ user, className }: AccountMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // "Sign out everywhere" waits for the menu to finish closing (and restoring focus) before the
  // dialog opens, so the two focus scopes don't fight.
  const confirmRequested = useRef(false)

  const signOut = useSignOut()
  const signingOut = useIsMutating({ mutationKey: signOutMutationKeys.all }) > 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            // Starts with the visible name (WCAG 2.5.3, label in name).
            aria-label={`${user.displayName}, account menu`}
            className={cn('h-auto w-full justify-start gap-2 px-1.5 py-1 text-left', className)}
          >
            <UserAvatar name={user.displayName} src={user.avatarUrl} status="online" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.displayName}</span>
              <span className="block text-xs font-normal text-muted-foreground">Online</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-56"
          onCloseAutoFocus={(event) => {
            if (confirmRequested.current) {
              confirmRequested.current = false
              event.preventDefault()
              setConfirmOpen(true)
            }
          }}
        >
          <DropdownMenuItem
            disabled={signingOut}
            onSelect={(event) => {
              // Keep the menu open so the disabled state shows while the request runs.
              event.preventDefault()
              signOut.mutate()
            }}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onSelect={() => {
              confirmRequested.current = true
            }}
          >
            <MonitorOff aria-hidden="true" />
            Sign out everywhere
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutEverywhereDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        returnFocusRef={triggerRef}
      />
    </>
  )
}
