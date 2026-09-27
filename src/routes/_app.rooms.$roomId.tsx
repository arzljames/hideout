import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MemberList } from '@/features/members'
import {
  loadRoom,
  redirectToLowercaseRoomId,
  RoomError,
  RoomLayout,
  RoomNotFound,
  roomQueryOptions,
  RoomSkeleton,
  useRoomEvents,
} from '@/features/rooms'
import { useRoomVoiceParticipants } from '@/features/voice'

export const Route = createFileRoute('/_app/rooms/$roomId')({
  beforeLoad: redirectToLowercaseRoomId,
  // A malformed id or an API 404 (missing room, or not a member) throws notFound().
  loader: ({ context, params }) => loadRoom(context.queryClient, params.roomId),
  pendingComponent: RoomSkeleton,
  errorComponent: ({ error }) => <RoomError error={error} />,
  notFoundComponent: () => <RoomNotFound />,
  component: RoomRoute,
})

function RoomRoute() {
  const { roomId } = Route.useParams()
  const { data: room } = useSuspenseQuery(roomQueryOptions(roomId))
  const { paused } = useRoomEvents(roomId)
  useRoomVoiceParticipants(roomId)

  return (
    <RoomLayout
      room={room}
      liveUpdatesPaused={paused}
      renderMembers={(className) => <MemberList room={room} className={className} />}
    >
      <Outlet />
    </RoomLayout>
  )
}
