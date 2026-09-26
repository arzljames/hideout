import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  RoomSettingsScreen,
  SettingsError,
  SettingsSkeleton,
  SettingsUnavailable,
  settingsSearchSchema,
} from '@/features/room-settings'
import {
  loadRoom,
  redirectToLowercaseRoomId,
  roomQueryOptions,
  useRoomEvents,
} from '@/features/rooms'

export const Route = createFileRoute('/_focus/rooms/$roomId/settings')({
  validateSearch: settingsSearchSchema,
  beforeLoad: redirectToLowercaseRoomId,
  // A malformed id or an API 404 (missing room, or not a member) throws notFound().
  loader: ({ context, params }) => loadRoom(context.queryClient, params.roomId),
  pendingComponent: SettingsSkeleton,
  errorComponent: ({ error }) => <SettingsError error={error} />,
  notFoundComponent: () => <SettingsUnavailable />,
  component: RoomSettingsRoute,
})

function RoomSettingsRoute() {
  const { roomId } = Route.useParams()
  const { data: room } = useSuspenseQuery(roomQueryOptions(roomId))
  const { section } = Route.useSearch()
  const { paused } = useRoomEvents(roomId)
  return <RoomSettingsScreen room={room} section={section} liveUpdatesPaused={paused} />
}
