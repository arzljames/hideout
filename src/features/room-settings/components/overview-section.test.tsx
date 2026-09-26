import { act, screen, waitFor, within } from '@testing-library/react'
import { applyRoomUpdated } from '@/features/rooms'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { roomNotFound } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const SETTINGS_PATH = `${roomPath(nightOwls)}/settings`

async function renderOverview() {
  const user = userEvent.setup()
  const result = await renderRoute(`${roomPath(nightOwls)}/settings`)
  return {
    user,
    ...result,
    name: screen.getByRole('textbox', { name: 'Room name' }),
    save: screen.getByRole('button', { name: 'Save changes' }),
  }
}

/** Emoji shown in the preview tile (outside the popover grid). */
function previewShows(emoji: string) {
  const grid = screen.queryByRole('radiogroup', { name: 'Room icon' })
  const main = screen.getByRole('main')
  return within(main)
    .queryAllByText(emoji)
    .some((node) => !grid?.contains(node))
}

describe('Overview', () => {
  it('shows the room name with a 10 / 48 counter that updates as you type', async () => {
    const { user, name } = await renderOverview()

    expect(name).toHaveValue('Night Owls')
    expect(name).toHaveAccessibleDescription('10 / 48 characters')
    expect(name).toHaveAttribute('maxLength', '48')

    await user.type(name, '!!')

    expect(name).toHaveAccessibleDescription('12 / 48 characters')
  })

  it('keeps Save disabled until the form changes, and again if you undo the change', async () => {
    const { user, name, save } = await renderOverview()
    expect(save).toBeDisabled()

    await user.type(name, 'x')
    expect(save).toBeEnabled()

    await user.type(name, '{Backspace}')
    expect(save).toBeDisabled()
  })

  it('flags a cleared name on submit with aria-invalid', async () => {
    const { user, name, save } = await renderOverview()

    await user.clear(name)
    await user.click(save)

    expect(await screen.findByText('Give your room a name')).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription(/Give your room a name/)
    expect(name).toHaveFocus()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('saves a valid change: toast, Save disabled again, new name kept', async () => {
    const { user, name, save } = await renderOverview()

    await user.clear(name)
    await user.type(name, 'Owl Parliament')
    await user.click(save)

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(save).toBeDisabled()
    expect(name).toHaveValue('Owl Parliament')
    expect(name).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('sends only the fields that changed', async () => {
    const bodies: unknown[] = []
    server.use(
      http.patch('*/api/rooms/:roomId', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({
          ...nightOwls,
          room: { ...nightOwls.room, name: 'Owl Parliament' },
        })
      }),
    )
    const { user, name, save } = await renderOverview()

    await user.clear(name)
    await user.type(name, 'Owl Parliament')
    await user.click(save)

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(bodies).toEqual([{ name: 'Owl Parliament' }])
  })

  it.each([
    [403, 'FORBIDDEN', 'Only owners and admins can change room settings.'],
    [429, 'RATE_LIMITED', 'Too many changes. Try again later.'],
  ])('toasts a %s on save and stays on Overview with the edit kept', async (status, code, message) => {
    server.use(
      http.patch('*/api/rooms/:roomId', () =>
        HttpResponse.json({ error: { code, message: 'Nope.' } }, { status }),
      ),
    )
    const { user, name, save, router } = await renderOverview()

    await user.type(name, '!')
    await user.click(save)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(SETTINGS_PATH)
    expect(name).toHaveValue('Night Owls!')
    expect(name).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('goes Home with a toast when the room is gone on save (404)', async () => {
    server.use(http.patch('*/api/rooms/:roomId', () => roomNotFound()))
    const { user, name, save, router } = await renderOverview()

    await user.type(name, '!')
    await user.click(save)

    expect(await screen.findByText("This room isn't available anymore.")).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows a 422 from the API on the name field', async () => {
    server.use(
      http.patch('*/api/rooms/:roomId', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Invalid room.',
              details: [{ path: 'body.name', message: 'Use visible characters.' }],
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { user, name, save } = await renderOverview()

    await user.type(name, '!')
    await user.click(save)

    expect(await screen.findByText('Use visible characters.')).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')
  })

  it('saves with Enter from the name field', async () => {
    const { user, name, save } = await renderOverview()

    await user.type(name, ' 2{Enter}')

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  it('picks a new emoji from the popover, updating the preview and enabling Save', async () => {
    const { user, save } = await renderOverview()
    const change = screen.getByRole('button', { name: 'Change emoji' })
    expect(previewShows('🦉')).toBe(true)

    await user.click(change)
    const grid = await screen.findByRole('radiogroup', { name: 'Room icon' })
    expect(within(grid).getAllByRole('radio')).toHaveLength(12)
    expect(within(grid).getByRole('radio', { name: 'Owl' })).toBeChecked()
    await user.click(within(grid).getByRole('radio', { name: 'Fire' }))

    expect(screen.queryByRole('radiogroup', { name: 'Room icon' })).not.toBeInTheDocument()
    expect(change).toHaveFocus()
    expect(previewShows('🔥')).toBe(true)
    expect(previewShows('🦉')).toBe(false)
    expect(save).toBeEnabled()

    await user.click(save)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  it('keeps the popover open when the current emoji is clicked again', async () => {
    const { user, save } = await renderOverview()

    await user.click(screen.getByRole('button', { name: 'Change emoji' }))
    const grid = await screen.findByRole('radiogroup', { name: 'Room icon' })
    await user.click(within(grid).getByRole('radio', { name: 'Owl' }))

    expect(within(grid).getByRole('radio', { name: 'Owl' })).toBeChecked()
    expect(save).toBeDisabled()
  })

  it('describes the icon field with the upload hint', async () => {
    await renderOverview()

    expect(screen.getByRole('button', { name: 'Upload image' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Room icon' })).toHaveAccessibleDescription(
      'PNG or JPG, at least 128 × 128.',
    )
  })
})

describe('Overview and changes from elsewhere', () => {
  it('follows a room:updated while the form is untouched', async () => {
    const { queryClient, name } = await renderOverview()

    // Query notifies observers asynchronously, so let the update settle inside act.
    await act(async () => {
      applyRoomUpdated(queryClient, {
        room: { ...nightOwls.room, name: 'Early Birds', icon: { kind: 'emoji', emoji: '🔥' } },
      })
    })

    await waitFor(() => expect(name).toHaveValue('Early Birds'), { timeout: 3000 })
    expect(previewShows('🔥')).toBe(true)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it("keeps the user's edit to a field, while untouched fields follow the room", async () => {
    const { user, queryClient, name, save } = await renderOverview()
    await user.clear(name)
    await user.type(name, 'Owl Parliament')

    // Query notifies observers asynchronously, so let the update settle inside act.
    await act(async () => {
      applyRoomUpdated(queryClient, {
        room: { ...nightOwls.room, name: 'Early Birds', icon: { kind: 'emoji', emoji: '🔥' } },
      })
    })

    await waitFor(() => expect(previewShows('🔥')).toBe(true), { timeout: 3000 })
    expect(name).toHaveValue('Owl Parliament')
    expect(save).toBeEnabled()
  })

  it('toasts once and goes Home when the room is gone on save (404)', async () => {
    server.use(
      http.patch('*/api/rooms/:roomId', () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Gone.' } }, { status: 404 }),
      ),
    )
    const { user, router, name, save } = await renderOverview()

    await user.type(name, '!')
    await user.click(save)

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(await screen.findAllByText("This room isn't available anymore.")).toHaveLength(1)
  })
})

describe('Delete room dialog (owner)', () => {
  async function openDelete() {
    const ctx = await renderOverview()
    const trigger = screen.getByRole('button', { name: 'Delete room' })
    await ctx.user.click(trigger)
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Night Owls?' })
    return {
      ...ctx,
      trigger,
      dialog,
      input: within(dialog).getByRole('textbox', { name: 'Type Night Owls to confirm' }),
      confirm: within(dialog).getByRole('button', { name: 'Delete room' }),
    }
  }

  it('opens with its title, a warning, and focus in the confirmation input', async () => {
    const { dialog, input } = await openDelete()

    expect(dialog).toHaveAccessibleDescription(
      "This deletes every channel and message for everyone. It can't be undone. Only the owner can do this.",
    )
    expect(input).toHaveFocus()
    expect(input).toHaveValue('')
  })

  it.each([
    ['', false],
    ['Night', false],
    ['night owls', false],
    ['NIGHT OWLS', false],
    ['Night Owls ', false],
    ['Night Owls', true],
  ])('with "%s" typed, the delete action enabled is %s', async (typed, enabled) => {
    const { user, input, confirm } = await openDelete()

    if (typed) await user.type(input, typed)

    if (enabled) expect(confirm).toBeEnabled()
    else expect(confirm).toBeDisabled()
  })

  it('returns focus to Delete room on Cancel', async () => {
    const { user, dialog, trigger } = await openDelete()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to Delete room on Escape', async () => {
    const { user, trigger } = await openDelete()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('confirms with Enter once the name matches, then deletes the room and goes Home', async () => {
    const { user, input, router } = await openDelete()

    await user.type(input, 'Night Owl{Enter}')
    expect(screen.getByRole('alertdialog', { name: 'Delete Night Owls?' })).toBeInTheDocument()

    await user.type(input, 's{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(await screen.findByText('Deleted Night Owls')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('treats a 404 on delete (already gone) like a delete: Home and a toast', async () => {
    server.use(http.delete('*/api/rooms/:roomId', () => roomNotFound()))
    const { user, input, router } = await openDelete()

    await user.type(input, 'Night Owls{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(await screen.findByText('Deleted Night Owls')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('clears the confirmation when reopened', async () => {
    const { user, input, trigger } = await openDelete()
    await user.type(input, 'Night Owls')
    await user.keyboard('{Escape}')

    await user.click(trigger)
    const reopened = await screen.findByRole('alertdialog', { name: 'Delete Night Owls?' })

    expect(within(reopened).getByRole('textbox', { name: 'Type Night Owls to confirm' })).toHaveValue('')
    expect(within(reopened).getByRole('button', { name: 'Delete room' })).toBeDisabled()
  })

  it('names the emoji popover', async () => {
    const { user } = await renderOverview()

    await user.click(screen.getByRole('button', { name: 'Change emoji' }))

    expect(await screen.findByRole('dialog', { name: 'Choose room emoji' })).toBeInTheDocument()
  })
})
