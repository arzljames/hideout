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
import { useRevokeInvite, type Invite } from '@/features/invites'
import { cn } from '@/lib/utils'

function usesLabel({ uses, maxUses }: Invite): string {
  if (maxUses === null) return `${uses} ${uses === 1 ? 'use' : 'uses'}`
  return `${uses} / ${maxUses} uses`
}

function expiryLabel({ expiresAt }: Invite): string {
  if (!expiresAt) return 'Never expires'
  const date = new Date(expiresAt)
  return `Expires ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
}

interface InviteLinkRowProps {
  roomId: string
  invite: Invite
  className?: string
}

/**
 * An active invite: link or direct (with the invitee's SteamID), creator, uses, expiry, and a
 * Revoke confirmation. Links never show their URL: the API only returns it once, at creation.
 */
export function InviteLinkRow({ roomId, invite, className }: InviteLinkRowProps) {
  const revoke = useRevokeInvite(roomId)
  const isLink = invite.kind === 'link'
  const title = isLink ? 'Invite link' : `Steam invite to ${invite.inviteeSteamId ?? 'unknown'}`
  const creator = invite.createdBy?.displayName

  return (
    <li className={cn('flex flex-wrap items-center gap-3 py-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {isLink ? (
            'Invite link'
          ) : (
            <>
              Steam invite to <span className="font-mono">{invite.inviteeSteamId}</span>
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {creator ? (
            <>
              Created by <bdi>{creator}</bdi>
            </>
          ) : (
            'Created by a deleted account'
          )}{' '}
          · {usesLabel(invite)} · {expiryLabel(invite)}
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label={`Revoke ${title.toLowerCase()}`}>
            Revoke
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              {isLink ? 'The link stops working right away.' : 'They can no longer accept it.'}{' '}
              People who already joined stay in the room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" onClick={() => revoke.mutate(invite.id)}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
