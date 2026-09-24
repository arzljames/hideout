import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import {
  getSampleRoom,
  RoomError,
  RoomLayout,
  RoomNotFound,
  RoomSkeleton,
} from '@/features/rooms'

export const Route = createFileRoute('/_app/rooms/$roomId')({
  loader: ({ params }) => {
    // TODO(api): context.queryClient.ensureQueryData(roomQueryOptions(params.roomId)); map an
    // API 404 (missing room or not a member) to notFound().
    const room = getSampleRoom(params.roomId)
    if (!room) throw notFound()
    return { room }
  },
  pendingComponent: RoomSkeleton,
  errorComponent: () => <RoomError />,
  notFoundComponent: () => <RoomNotFound />,
  component: RoomRoute,
})

function RoomRoute() {
  // TODO(api): read with useSuspenseQuery(roomQueryOptions(roomId)) instead of loader data.
  const { room } = Route.useLoaderData()

  return (
    <RoomLayout room={room}>
      <Outlet />
    </RoomLayout>
  )
}
