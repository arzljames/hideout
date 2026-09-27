import { useSuspenseQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isolate } from '@/lib/bidi'
import { cn } from '@/lib/utils'
import { inboxQueryOptions, useAcceptInvite, useDeclineInvite } from '../api'
import { isInboxInviteLive } from '../invite-cache'
import type { InboxInvite } from '../types'
import { InviteRequestCard } from './invite-request-card'
import { InvitesEmptyState } from './invites-empty-state'

/** Where focus goes after an invite is removed: another card's Accept, or the empty state. */
type FocusTarget = { kind: 'accept'; inviteId: string } | { kind: 'empty' }

interface InvitesInboxProps {
  className?: string
}

/** The Invites page: pending direct invites with Accept / Decline. */
export function InvitesInbox({ className }: InvitesInboxProps) {
  const { data } = useSuspenseQuery(inboxQueryOptions)
  const invites = data.filter((invite) => isInboxInviteLive(invite))
  const accept = useAcceptInvite()
  const decline = useDeclineInvite()
  const [announcement, setAnnouncement] = useState('')

  const acceptButtons = useRef(new Map<string, HTMLButtonElement>())
  const emptyTitleRef = useRef<HTMLHeadingElement>(null)
  const focusAfterRemoval = useRef<FocusTarget | null>(null)

  // After the list re-renders without the removed card, move focus somewhere sensible so it
  // doesn't fall back to <body>.
  useLayoutEffect(() => {
    const target = focusAfterRemoval.current
    if (!target) return
    if (target.kind === 'accept' && !acceptButtons.current.has(target.inviteId)) return
    focusAfterRemoval.current = null
    if (target.kind === 'empty') emptyTitleRef.current?.focus()
    else acceptButtons.current.get(target.inviteId)?.focus()
  }, [data])

  function planFocus(removed: InboxInvite) {
    const index = invites.findIndex((invite) => invite.inviteId === removed.inviteId)
    const neighbour = invites[index + 1] ?? invites[index - 1]
    focusAfterRemoval.current = neighbour
      ? { kind: 'accept', inviteId: neighbour.inviteId }
      : { kind: 'empty' }
  }

  function handleAccept(invite: InboxInvite) {
    planFocus(invite)
    // The success toast announces the join (sonner is a live region); don't repeat it here.
    setAnnouncement('')
    accept.mutate(invite)
  }

  function handleDecline(invite: InboxInvite) {
    planFocus(invite)
    decline.mutate(invite, {
      // Name the room so declining twice in a row still changes the text (and is announced).
      onSuccess: () => setAnnouncement(`Declined invite to ${isolate(invite.room.name)}`),
    })
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
          <ul
            role="list"
            aria-label="Pending invites"
            className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:py-8"
          >
            {invites.map((invite) => (
              <li key={invite.inviteId}>
                <InviteRequestCard
                  invite={invite}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  acceptRef={(node) => {
                    if (node) acceptButtons.current.set(invite.inviteId, node)
                    else acceptButtons.current.delete(invite.inviteId)
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
