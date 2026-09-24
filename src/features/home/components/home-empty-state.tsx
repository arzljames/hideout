import { Link as LinkIcon, Lock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateRoomDialog } from '@/features/rooms'
import { CenteredState } from '@/features/shell'

interface HomeEmptyStateProps {
  className?: string
}

/** Shown on Home when the user isn't in any rooms yet. */
export function HomeEmptyState({ className }: HomeEmptyStateProps) {
  return (
    <CenteredState
      className={className}
      icon={<Lock aria-hidden="true" />}
      title="Rooms are private"
      description="Nobody can find a room without an invite from someone inside it. Create one for your squad, or paste an invite link you were sent."
      actions={
        <>
          <CreateRoomDialog>
            <Button type="button" size="lg">
              <Plus aria-hidden="true" />
              Create a room
            </Button>
          </CreateRoomDialog>
          {/* TODO(invites): open a Dialog to paste an invite link, then navigate to /invite/$token. */}
          <Button type="button" variant="outline">
            <LinkIcon aria-hidden="true" />
            Have an invite link? Paste it here
          </Button>
        </>
      }
    />
  )
}
