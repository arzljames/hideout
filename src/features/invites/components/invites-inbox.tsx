import { Inbox } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AppHeader } from '@/components/app-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { usePendingInvitesStore } from '../pending-invites-store'
import type { PendingInvite } from '../sample-pending-invites'
import { InviteRequestCard } from './invite-request-card'
import { InvitesEmptyState } from './invites-empty-state'

/** Where focus goes after an invite is removed: another card's Accept, or the empty state. */
type FocusTarget = { kind: 'accept'; inviteId: string } | { kind: 'empty' }

interface InvitesInboxProps {
  className?: string
}

/** The Invites page: pending room invites with Accept / Decline. */
export function InvitesInbox({ className }: InvitesInboxProps) {
  const invites = usePendingInvitesStore((s) => s.invites)
  const accept = usePendingInvitesStore((s) => s.accept)
  const decline = usePendingInvitesStore((s) => s.decline)
  const [announcement, setAnnouncement] = useState('')

  const acceptButtons = useRef(new Map<string, HTMLButtonElement>())
  const emptyTitleRef = useRef<HTMLHeadingElement>(null)
  const focusAfterRemoval = useRef<FocusTarget | null>(null)

  // After the list re-renders without the removed card, move focus somewhere sensible so it
  // doesn't fall back to <body>.
  useLayoutEffect(() => {
    const target = focusAfterRemoval.current
    if (!target) return
    focusAfterRemoval.current = null
    if (target.kind === 'empty') emptyTitleRef.current?.focus()
    else acceptButtons.current.get(target.inviteId)?.focus()
  }, [invites])

  function planFocus(removed: PendingInvite) {
    const index = invites.findIndex((invite) => invite.id === removed.id)
    const neighbour = invites[index + 1] ?? invites[index - 1]
    focusAfterRemoval.current = neighbour
      ? { kind: 'accept', inviteId: neighbour.id }
      : { kind: 'empty' }
  }

  function handleAccept(invite: PendingInvite) {
    // TODO(api): accept invite, invalidate rooms, navigate to the room.
    planFocus(invite)
    accept(invite.id)
    // sonner's toaster is itself a polite live region, so the toast announces the join; writing it
    // to our region too would be read twice.
    setAnnouncement('')
    toast.success(`Joined ${invite.room.name}`)
  }

  function handleDecline(invite: PendingInvite) {
    // TODO(api): decline invite.
    planFocus(invite)
    decline(invite.id)
    // Name the room so declining twice in a row still changes the text (and is announced).
    setAnnouncement(`Declined invite to ${invite.room.name}`)
  }

  const count = invites.length

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <AppHeader
        title="Invites"
        icon={<Inbox aria-hidden="true" />}
        description={count > 0 ? `${count} pending` : undefined}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {count > 0 ? (
        <ScrollArea className="min-h-0 flex-1">
          <ul role="list" aria-label="Pending invites" className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:py-8">
            {invites.map((invite) => (
              <li key={invite.id}>
                <InviteRequestCard
                  invite={invite}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  acceptRef={(node) => {
                    if (node) acceptButtons.current.set(invite.id, node)
                    else acceptButtons.current.delete(invite.id)
                  }}
                />
              </li>
            ))}
          </ul>
        </ScrollArea>
      ) : (
        <InvitesEmptyState titleRef={emptyTitleRef} />
      )}
    </div>
  )
}
