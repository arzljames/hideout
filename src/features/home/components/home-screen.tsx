import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useId } from 'react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { CreateRoomDialog, roomsQueryOptions } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { HomeEmptyState } from './home-empty-state'
import { HomeRoomLink } from './home-room-link'
import { HomeRoomsError } from './home-rooms-error'
import { HomeRoomsSkeleton } from './home-rooms-skeleton'

interface HomeScreenProps {
  className?: string
}

/** Home page content, rendered inside the app shell's main area: your rooms. */
export function HomeScreen({ className }: HomeScreenProps) {
  const headingId = useId()
  // useQuery, not a loader: a failed room list shouldn't take down the page.
  const rooms = useQuery(roomsQueryOptions)
  // A failed background refetch keeps the last list (TanStack Query keeps `data`), so the
  // error state is only for a list that never loaded.
  const hasRooms = (rooms.data?.length ?? 0) > 0

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      <AppHeader
        title="Home"
        actions={
          hasRooms && (
            <CreateRoomDialog>
              <Button type="button" size="sm">
                <Plus aria-hidden="true" />
                Create a room
              </Button>
            </CreateRoomDialog>
          )
        }
      />
      {rooms.isPending ? (
        <HomeRoomsSkeleton className="mx-auto w-full max-w-2xl p-4 md:p-6" />
      ) : !rooms.data ? (
        <HomeRoomsError
          error={rooms.error}
          retrying={rooms.isFetching}
          onRetry={() => void rooms.refetch()}
        />
      ) : hasRooms ? (
        <section aria-labelledby={headingId} className="mx-auto w-full max-w-2xl p-4 md:p-6">
          <h2 id={headingId} className="mb-3 text-sm font-semibold">
            Your rooms
          </h2>
          <ul role="list" className="flex flex-col gap-2">
            {rooms.data?.map((entry) => (
              <li key={entry.room.id}>
                <HomeRoomLink entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <HomeEmptyState />
      )}
    </div>
  )
}
