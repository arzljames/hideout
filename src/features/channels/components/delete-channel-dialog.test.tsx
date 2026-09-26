import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { useVoiceStore } from '@/features/voice'
import { isolate } from '@/lib/bidi'
import { apiError, chooseChannelAction, sidebarNames } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { recordRequests } from '@/test/msw/requests'
import { roomDetailHandler } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const DELETE_PATH = '*/api/channels/:channelId'

async function openDelete(channelName: string, { at = 'general' }: { at?: string } = {}) {
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(nightOwls, at))
  const trigger = await chooseChannelAction(user, channelName, 'Delete')
  const dialog = await screen.findByRole('alertdialog', { name: `Delete #${channelName}?` })
  const confirm = within(dialog).getByRole('button', { name: 'Delete channel' })
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
  return { user, trigger, dialog, confirm, cancel, ...result }
}

describe('DeleteChannelDialog', () => {
  it('focuses Cancel first, and Cancel returns focus to the … button without deleting', async () => {
    const deletes = recordRequests('delete', DELETE_PATH)
    const { user, trigger, dialog, cancel } = await openDelete('planning')

    expect(cancel).toHaveFocus()
    expect(dialog).toHaveAccessibleDescription('Messages in it are deleted too.')
    await user.click(cancel)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(deletes.count).toBe(0)
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })

  it('deletes a channel you are not viewing: removes it, toasts and stays put', async () => {
    const deletes = recordRequests('delete', DELETE_PATH)
    const { user, router, confirm } = await openDelete('planning')

    await user.click(confirm)

    expect(await screen.findByText(`Deleted #${isolate('planning')}`)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips'])
    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(deletes.count).toBe(1)
    // The row is gone, so focus falls back to the group's Create button.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create text channel' })).toHaveFocus(),
    )
  })

  it('deleting the channel you are viewing lands on the lowest remaining text channel', async () => {
    const { user, router, confirm } = await openDelete('general')

    await user.click(confirm)

    expect(await screen.findByText(`Deleted #${isolate('general')}`)).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'clips')))
    expect(await screen.findByRole('heading', { level: 1, name: 'clips' })).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['clips', 'planning'])
  })

  it('deleting the voice channel you are connected to ends the voice session', async () => {
    const voice = channelOf(nightOwls, 'voice')
    useVoiceStore.setState({
      connection: {
        status: 'connected',
        roomId: nightOwls.room.id,
        roomName: nightOwls.room.name,
        channelId: voice.id,
        channelName: voice.name,
      },
    })
    const { user, confirm } = await openDelete('voice')

    await user.click(confirm)

    expect(await screen.findByText(`Deleted #${isolate('voice')}`)).toBeInTheDocument()
    // Reset to the store's initial state (TODO(livekit): that's still the design sample).
    expect(useVoiceStore.getState().connection?.channelId).not.toBe(voice.id)
    expect(sidebarNames('Voice channels')).toEqual(['late night'])
  })

  it('leaves the voice session alone when deleting a different voice channel', async () => {
    const voice = channelOf(nightOwls, 'voice')
    const connection = {
      status: 'connected' as const,
      roomId: nightOwls.room.id,
      roomName: nightOwls.room.name,
      channelId: voice.id,
      channelName: voice.name,
    }
    useVoiceStore.setState({ connection })
    const { user, confirm } = await openDelete('late night')

    await user.click(confirm)

    expect(await screen.findByText(`Deleted #${isolate('late night')}`)).toBeInTheDocument()
    expect(useVoiceStore.getState().connection).toEqual(connection)
  })

  it("disables Delete for the room's only text channel and says why", async () => {
    const onlyGeneral = {
      ...nightOwls,
      channels: nightOwls.channels.filter(
        (channel) => channel.type === 'voice' || channel.name === 'general',
      ),
    }
    server.use(roomDetailHandler([onlyGeneral]))
    const deletes = recordRequests('delete', DELETE_PATH)
    const { dialog, confirm } = await openDelete('general')

    expect(confirm).toBeDisabled()
    expect(within(dialog).getByText('A room needs at least one text channel.')).toBeInTheDocument()
    expect(deletes.count).toBe(0)
  })

  it('shows 409 LAST_TEXT_CHANNEL from the API and keeps the dialog open', async () => {
    server.use(
      http.delete(DELETE_PATH, () =>
        apiError(409, 'LAST_TEXT_CHANNEL', 'A room needs at least one text channel.'),
      ),
    )
    const { user, dialog, confirm } = await openDelete('planning')

    await user.click(confirm)

    expect(
      await within(dialog).findByText('A room needs at least one text channel.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Delete #planning?' })).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })

  it('treats a 404 (already deleted) as done', async () => {
    server.use(http.delete(DELETE_PATH, () => apiError(404, 'NOT_FOUND', 'Channel not found.')))
    const { user, confirm } = await openDelete('planning')

    await user.click(confirm)

    expect(await screen.findByText(`Deleted #${isolate('planning')}`)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips'])
  })

  it('on 403: toasts, closes and refetches the room, keeping the channel', async () => {
    server.use(http.delete(DELETE_PATH, () => apiError(403, 'FORBIDDEN', 'Not allowed.')))
    const { user, confirm } = await openDelete('planning')
    const roomGets = recordRequests('get', `*/api/rooms/${nightOwls.room.id}`)

    await user.click(confirm)

    expect(await screen.findByText('Only owners and admins can manage channels.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(roomGets.count).toBe(1))
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })
})

describe('DeleteChannelDialog in Room settings', () => {
  it('deleting the last voice channel: toasts, shows the empty state and focuses Create channel', async () => {
    const oneVoice = {
      ...nightOwls,
      channels: nightOwls.channels.filter(
        (channel) => channel.type === 'text' || channel.name === 'voice',
      ),
    }
    server.use(roomDetailHandler([oneVoice]))
    const user = userEvent.setup()
    await renderRoute(`${roomPath(nightOwls)}/settings?section=channels`)
    const region = screen.getByRole('region', { name: 'Voice channels' })

    await user.click(within(region).getByRole('button', { name: 'Delete voice' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete #voice?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete channel' }))

    expect(await screen.findByText(`Deleted #${isolate('voice')}`)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(region).getByText('No voice channels yet')).toBeInTheDocument()
    await waitFor(() =>
      expect(within(region).getByRole('button', { name: 'Create channel' })).toHaveFocus(),
    )
  })
})
