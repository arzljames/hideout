import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChannelScreen } from '@/features/channels'
import { isRoomId, roomQueryOptions } from '@/features/rooms'

export const Route = createFileRoute('/_app/rooms/$roomId/$channelId')({
  loader: async ({ context, params }) => {
    if (!isRoomId(params.roomId)) return
    // Shares the room layout loader's request. Its failures (404, offline) are the layout's
    // to show, so they're ignored here.
    const room = await context.queryClient
      .ensureQueryData(roomQueryOptions(params.roomId))
      .catch(() => null)
    if (room && !room.channels.some((channel) => channel.id === params.channelId)) {
      throw notFound()
    }
  },
  // ChannelScreen renders "This channel doesn't exist" for an unknown channel.
  notFoundComponent: ChannelRoute,
  component: ChannelRoute,
})

function ChannelRoute() {
  const { roomId, channelId } = Route.useParams()
  return <ChannelScreen roomId={roomId} channelId={channelId} />
}
