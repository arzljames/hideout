import { Link as LinkIcon, UserPlus } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
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
import { cn } from '@/lib/utils'
import { InviteLinkTab } from './invite-link-tab'
import { InviteSteamTab } from './invite-steam-tab'

interface InviteDialogProps {
  roomName: string
  /** Optional trigger, rendered via `DialogTrigger asChild`; Radix returns focus to it. */
  children?: ReactNode
  /** Controlled open state, for opening from somewhere that isn't a DialogTrigger (a menu item). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Where focus goes on close when there's no DialogTrigger (e.g. the menu's trigger). */
  returnFocusRef?: RefObject<HTMLElement | null>
  className?: string
}

/** Invite people to a room by link or by Steam user. */
export function InviteDialog({
  roomName,
  children,
  open,
  onOpenChange,
  returnFocusRef,
  className,
}: InviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <DialogTitle>Invite people to {roomName}</DialogTitle>
          <DialogDescription className="sr-only">
            Share an invite link or invite a Steam user directly.
          </DialogDescription>
        </DialogHeader>

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
            <InviteLinkTab roomName={roomName} />
          </TabsContent>
          <TabsContent value="steam" className="pt-2">
            <InviteSteamTab />
          </TabsContent>
        </Tabs>

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
