import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSampleRoom } from '@/features/rooms'

export const Route = createFileRoute('/_app/rooms/$roomId/')({
  beforeLoad: ({ params }) => {
    // TODO(api): read the default channel from roomQueryOptions via context.queryClient.
    const room = getSampleRoom(params.roomId)
    // A missing room falls through to the room layout's loader, which throws notFound().
    if (room) {
      throw redirect({
        to: '/rooms/$roomId/$channelId',
        params: { roomId: room.id, channelId: room.defaultChannelId },
        replace: true,
      })
    }
  },
})
