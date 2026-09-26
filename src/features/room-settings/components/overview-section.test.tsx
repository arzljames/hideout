import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

async function renderOverview() {
  const user = userEvent.setup()
  const result = await renderRoute('/rooms/night-owls/settings')
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
  it('shows the room name with a 10 / 40 counter that updates as you type', async () => {
    const { user, name } = await renderOverview()

    expect(name).toHaveValue('Night Owls')
    expect(name).toHaveAccessibleDescription('10 / 40 characters')
    expect(name).toHaveAttribute('maxLength', '40')

    await user.type(name, '!!')

    expect(name).toHaveAccessibleDescription('12 / 40 characters')
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
    expect(screen.queryByText('Changes saved')).not.toBeInTheDocument()
  })

  it('saves a valid change: toast, Save disabled again, new name kept', async () => {
    const { user, name, save } = await renderOverview()

    await user.clear(name)
    await user.type(name, 'Owl Parliament')
    await user.click(save)

    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
    expect(save).toBeDisabled()
    expect(name).toHaveValue('Owl Parliament')
    expect(name).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('saves with Enter from the name field', async () => {
    const { user, name, save } = await renderOverview()

    await user.type(name, ' 2{Enter}')

    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
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
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
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

  it('confirms with Enter once the name matches, and closes', async () => {
    const { user, input, trigger } = await openDelete()

    await user.type(input, 'Night Owl{Enter}')
    expect(screen.getByRole('alertdialog', { name: 'Delete Night Owls?' })).toBeInTheDocument()

    await user.type(input, 's{Enter}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
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
