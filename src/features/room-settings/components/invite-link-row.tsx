import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { RoomInviteLink } from '../sample-invite-links'
import { cn } from '@/lib/utils'

function usesLabel({ uses, maxUses }: RoomInviteLink): string {
  if (maxUses === null) return `${uses} ${uses === 1 ? 'use' : 'uses'}`
  return `${uses} / ${maxUses} uses`
}

interface InviteLinkRowProps {
  invite: RoomInviteLink
  className?: string
}

/** An active invite link with its usage, expiry and a Revoke confirmation. */
export function InviteLinkRow({ invite, className }: InviteLinkRowProps) {
  return (
    <li className={cn('flex flex-wrap items-center gap-3 py-3', className)}>
      <div className="min-w-0 flex-1">
        {/* TODO(api): the invite URL host comes from the API response. */}
        <p className="truncate font-mono text-sm">hideout.gg/i/{invite.code}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Created by {invite.createdBy} · {usesLabel(invite)} ·{' '}
          {invite.expiresIn ? `Expires in ${invite.expiresIn}` : 'Never expires'}
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label={`Revoke invite ${invite.code}`}>
            Revoke
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invite {invite.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              The link stops working right away. People who already joined stay in the room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* TODO(api): revoke invite mutation; toast; invalidate invites. */}
            <AlertDialogAction variant="destructive-solid">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
