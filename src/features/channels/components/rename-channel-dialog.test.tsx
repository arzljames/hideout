import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { isolate } from '@/lib/bidi'
import { apiError, channelNav, chooseChannelAction, sidebarNames } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { recordRequests } from '@/test/msw/requests'
import { roomNotFound } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const RENAME_PATH = '*/api/channels/:channelId'

async function openRename(channelName: string) {
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(nightOwls, 'general'))
  const trigger = await chooseChannelAction(user, channelName, 'Rename')
  const dialog = await screen.findByRole('dialog', { name: `Rename #${channelName}` })
  const nameInput = within(dialog).getByRole('textbox', { name: 'Channel name' })
  const save = within(dialog).getByRole('button', { name: 'Save' })
  return { user, trigger, dialog, nameInput, save, ...result }
}

describe('RenameChannelDialog', () => {
  it('opens prefilled and focused, renames the channel in the sidebar and returns focus to its … button', async () => {
    const patches = recordRequests('patch', RENAME_PATH)
    const { user, trigger, nameInput, save } = await openRename('clips')
    expect(nameInput).toHaveValue('clips')
    expect(nameInput).toHaveFocus()

    await user.clear(nameInput)
    await user.type(nameInput, 'highlights')
    await user.click(save)

    expect(await screen.findByText(`Renamed to #${isolate('highlights')}`)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Rename #clips' })).not.toBeInTheDocument()
    expect(patches.bodies).toEqual([{ name: 'highlights' }])
    expect(sidebarNames('Text channels')).toEqual(['general', 'highlights', 'planning'])
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(trigger).toHaveAccessibleName('Channel options for #highlights')
  })

  it('closes without a request when the name is unchanged', async () => {
    const patches = recordRequests('patch', RENAME_PATH)
    const { user, trigger, save } = await openRename('clips')

    await user.click(save)

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Rename #clips' })).not.toBeInTheDocument(),
    )
    expect(patches.count).toBe(0)
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('returns focus to the … button on Cancel', async () => {
    const { user, trigger, dialog } = await openRename('planning')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('puts CHANNEL_NAME_TAKEN from the API on the name field', async () => {
    server.use(
      http.patch(RENAME_PATH, () =>
        apiError(409, 'CHANNEL_NAME_TAKEN', 'A text channel with that name already exists.'),
      ),
    )
    const { user, dialog, nameInput, save } = await openRename('clips')

    await user.clear(nameInput)
    await user.type(nameInput, 'highlights')
    await user.click(save)

    await waitFor(() =>
      expect(nameInput).toHaveAccessibleDescription(
        expect.stringContaining("There's already a channel called that."),
      ),
    )
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    expect(dialog).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })

  it('catches a name taken by another text channel before calling the API', async () => {
    const patches = recordRequests('patch', RENAME_PATH)
    const { user, nameInput, save } = await openRename('clips')

    await user.clear(nameInput)
    await user.type(nameInput, 'GENERAL')
    await user.click(save)

    await waitFor(() =>
      expect(nameInput).toHaveAccessibleDescription(
        expect.stringContaining("There's already a channel called that."),
      ),
    )
    expect(patches.count).toBe(0)
  })

  it('shows a 422 validation message for body.name on the name field', async () => {
    server.use(
      http.patch(RENAME_PATH, () =>
        apiError(422, 'VALIDATION_FAILED', 'Invalid request.', [
          { path: 'body.name', message: 'That name is reserved.' },
        ]),
      ),
    )
    const { user, nameInput, save } = await openRename('clips')

    await user.clear(nameInput)
    await user.type(nameInput, 'admin')
    await user.click(save)

    await waitFor(() =>
      expect(nameInput).toHaveAccessibleDescription(expect.stringContaining('That name is reserved.')),
    )
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('on 403: toasts, closes and refetches the room, which drops the controls for a demoted user', async () => {
    let roomGets = 0
    server.use(
      http.get(`*/api/rooms/${nightOwls.room.id}`, () => {
        roomGets += 1
        return HttpResponse.json(roomGets === 1 ? nightOwls : { ...nightOwls, myRole: 'member' })
      }),
      http.patch(RENAME_PATH, () => apiError(403, 'FORBIDDEN', 'Not allowed.')),
    )
    const { user, nameInput, save } = await openRename('clips')

    await user.clear(nameInput)
    await user.type(nameInput, 'highlights')
    await user.click(save)

    expect(await screen.findByText('Only owners and admins can manage channels.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(roomGets).toBe(2))
    await waitFor(() =>
      expect(
        within(channelNav()).queryByRole('button', { name: /^Channel options for/ }),
      ).not.toBeInTheDocument(),
    )
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })

  it('on 404 when the room itself is gone: goes Home and says you are no longer in the room', async () => {
    const { user, router, nameInput, save } = await openRename('clips')
    server.use(
      http.get(`*/api/rooms/${nightOwls.room.id}`, () => roomNotFound()),
      http.patch(RENAME_PATH, () => apiError(404, 'NOT_FOUND', 'Channel not found.')),
    )

    await user.clear(nameInput)
    await user.type(nameInput, 'highlights')
    await user.click(save)

    expect(await screen.findByText("You're no longer in Night Owls.")).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('on 404 when only the channel is gone: shows that it is not available anymore', async () => {
    const { user, dialog, nameInput, save } = await openRename('clips')
    server.use(http.patch(RENAME_PATH, () => apiError(404, 'NOT_FOUND', 'Channel not found.')))

    await user.clear(nameInput)
    await user.type(nameInput, 'highlights')
    await user.click(save)

    expect(
      await within(dialog).findByText("This channel isn't available anymore."),
    ).toBeInTheDocument()
  })
})
