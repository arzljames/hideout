import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChannelScreen } from '@/features/channels'
import { getRoomChannel, getSampleRoom } from '@/features/rooms'

export const Route = createFileRoute('/_app/rooms/$roomId/$channelId')({
  loader: ({ params }) => {
    // TODO(api): channels come with roomQueryOptions; check the cached room instead.
    const room = getSampleRoom(params.roomId)
    if (room && !getRoomChannel(room, params.channelId)) throw notFound()
  },
  // ChannelScreen renders "This channel doesn't exist" for an unknown channel.
  notFoundComponent: ChannelRoute,
  component: ChannelRoute,
})

function ChannelRoute() {
  const { roomId, channelId } = Route.useParams()
  return <ChannelScreen roomId={roomId} channelId={channelId} />
}
