import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { loadRoom, RoomNoChannels, roomQueryOptions } from '@/features/rooms'

export const Route = createFileRoute('/_app/rooms/$roomId/')({
  beforeLoad: async ({ context, params }) => {
    // Unknown rooms throw notFound(), shown by the room layout's notFoundComponent.
    const room = await loadRoom(context.queryClient, params.roomId)
    if (room.defaultChannelId) {
      throw redirect({
        to: '/rooms/$roomId/$channelId',
        params: { roomId: params.roomId, channelId: room.defaultChannelId },
        replace: true,
      })
    }
  },
  // Only reached when the room has no text channel.
  component: RoomIndexRoute,
})

function RoomIndexRoute() {
  const { roomId } = Route.useParams()
  const { data: room } = useSuspenseQuery(roomQueryOptions(roomId))
  return <RoomNoChannels room={room} />
}
