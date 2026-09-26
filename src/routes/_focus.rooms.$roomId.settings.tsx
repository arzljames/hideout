import { createFileRoute, notFound } from '@tanstack/react-router'
import {
  RoomSettingsScreen,
  SettingsError,
  SettingsSkeleton,
  SettingsUnavailable,
  settingsSearchSchema,
} from '@/features/room-settings'
import { getSampleRoom } from '@/features/rooms'

export const Route = createFileRoute('/_focus/rooms/$roomId/settings')({
  validateSearch: settingsSearchSchema,
  loader: ({ params }) => {
    // TODO(api): context.queryClient.ensureQueryData(roomQueryOptions(params.roomId)); map an
    // API 404 (missing room or not a member) to notFound().
    const room = getSampleRoom(params.roomId)
    if (!room) throw notFound()
    return { room }
  },
  pendingComponent: SettingsSkeleton,
  errorComponent: () => <SettingsError />,
  notFoundComponent: () => <SettingsUnavailable />,
  component: RoomSettingsRoute,
})

function RoomSettingsRoute() {
  const { room } = Route.useLoaderData()
  const { section } = Route.useSearch()
  return <RoomSettingsScreen room={room} section={section} />
}
