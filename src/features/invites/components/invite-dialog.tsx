import { Link as LinkIcon, UserPlus } from 'lucide-react'
import { useState, type ReactNode, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Role } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { InviteLinkTab } from './invite-link-tab'
import { InviteSteamTab } from './invite-steam-tab'

interface InviteDialogProps {
  roomId: string
  roomName: string
  /** Links are for owners and admins; plain members only see the Steam user form. */
  myRole: Role
  /** Optional trigger, rendered via `DialogTrigger asChild`; Radix returns focus to it. */
  children?: ReactNode
  /** Controlled open state, for opening from somewhere that isn't a DialogTrigger (a menu item). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Where focus goes on close when there's no DialogTrigger (e.g. the menu's trigger). */
  returnFocusRef?: RefObject<HTMLElement | null>
  className?: string
}

/**
 * Invite people to a room: by link (owner/admin) or by Steam account (any member). The content
 * unmounts on close, so a created link is never shown again after the dialog closes.
 */
export function InviteDialog({
  roomId,
  roomName,
  myRole,
  children,
  open,
  onOpenChange,
  returnFocusRef,
  className,
}: InviteDialogProps) {
  const canCreateLinks = myRole !== 'member'
  // Works controlled (menu item) or uncontrolled (DialogTrigger), so a sent invite can close it.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isOpen = open ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const close = () => setOpen(false)

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        className={cn('sm:max-w-md', className)}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current
          if (target?.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Invite people to <bdi>{roomName}</bdi>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {canCreateLinks
              ? 'Create an invite link or invite a Steam user directly.'
              : 'Invite a Steam user directly.'}
          </DialogDescription>
        </DialogHeader>

        {/* UI-only gate; hideout-api answers 403 to a plain member creating a link. */}
        {canCreateLinks ? (
          <Tabs defaultValue="link">
            <TabsList className="w-full">
              <TabsTrigger value="link">
                <LinkIcon aria-hidden="true" />
                Invite link
              </TabsTrigger>
              <TabsTrigger value="steam">
                <UserPlus aria-hidden="true" />
                Invite a Steam user
              </TabsTrigger>
            </TabsList>
            <TabsContent value="link" className="pt-2">
              <InviteLinkTab roomId={roomId} roomName={roomName} />
            </TabsContent>
            <TabsContent value="steam" className="pt-2">
              <InviteSteamTab roomId={roomId} onSent={close} />
            </TabsContent>
          </Tabs>
        ) : (
          <InviteSteamTab roomId={roomId} onSent={close} />
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
