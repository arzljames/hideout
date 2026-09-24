import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

async function renderHome() {
  const user = userEvent.setup()
  // The shell reads route params and renders typed Links, so render the real route tree.
  await renderRoute('/')
  return { user }
}

function emptyStateTrigger() {
  return within(screen.getByRole('main')).getByRole('button', { name: 'Create a room' })
}

function railTrigger() {
  return within(screen.getByRole('navigation', { name: 'Rooms' })).getByRole('button', {
    name: 'Create a room',
  })
}

async function openFrom(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Create a room' })
  return {
    dialog,
    nameInput: within(dialog).getByRole('textbox', { name: 'Room name' }),
    iconGroup: within(dialog).getByRole('radiogroup', { name: 'Room icon' }),
  }
}

/** Emoji shown outside the picker grid, i.e. in the preview tile. */
function previewEmoji(dialog: HTMLElement, iconGroup: HTMLElement) {
  const shown = ['🦉', '🔥'].filter((emoji) =>
    within(dialog)
      .queryAllByText(emoji)
      .some((node) => !iconGroup.contains(node)),
  )
  return shown
}

describe('CreateRoomDialog', () => {
  it.each([
    ['the empty-state button', emptyStateTrigger],
    ['the rail + button', railTrigger],
  ])('opens from %s with its title and description', async (_label, getTrigger) => {
    const { user } = await renderHome()

    const { dialog } = await openFrom(user, getTrigger())

    expect(within(dialog).getByRole('heading', { name: 'Create a room' })).toBeInTheDocument()
    expect(dialog).toHaveAccessibleDescription('Only people you invite can see it or join.')
  })

  it('focuses the room name input when it opens', async () => {
    const { user } = await renderHome()

    const { nameInput } = await openFrom(user, emptyStateTrigger())

    expect(nameInput).toHaveFocus()
  })

  it('shows a character counter that updates as you type', async () => {
    const { user } = await renderHome()
    const { nameInput } = await openFrom(user, emptyStateTrigger())

    expect(nameInput).toHaveAccessibleDescription('0/40 characters')

    await user.type(nameInput, 'Night Owls')

    expect(nameInput).toHaveAccessibleDescription('10/40 characters')
  })

  it('stops typing at 40 characters', async () => {
    const { user } = await renderHome()
    const { nameInput } = await openFrom(user, emptyStateTrigger())

    await user.type(nameInput, 'x'.repeat(45))

    expect(nameInput).toHaveValue('x'.repeat(40))
    expect(nameInput).toHaveAccessibleDescription('40/40 characters')
  })

  it('flags an empty name on submit and moves focus to the input', async () => {
    const { user } = await renderHome()
    const { dialog, nameInput } = await openFrom(user, emptyStateTrigger())

    await user.click(within(dialog).getByRole('button', { name: 'Create room' }))

    expect(await within(dialog).findByText('Give your room a name')).toBeInTheDocument()
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput).toHaveAccessibleDescription(/Give your room a name/)
    expect(nameInput).toHaveFocus()
    expect(dialog).toBeInTheDocument()
  })

  it('offers 12 room icons with Owl selected by default', async () => {
    const { user } = await renderHome()
    const { dialog, iconGroup } = await openFrom(user, emptyStateTrigger())

    const radios = within(iconGroup).getAllByRole('radio')
    expect(radios).toHaveLength(12)
    expect(within(iconGroup).getByRole('radio', { name: 'Owl' })).toBeChecked()
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    expect(previewEmoji(dialog, iconGroup)).toEqual(['🦉'])
  })

  it('keeps Owl selected when it is clicked again', async () => {
    const { user } = await renderHome()
    const { iconGroup } = await openFrom(user, emptyStateTrigger())

    const owl = within(iconGroup).getByRole('radio', { name: 'Owl' })
    await user.click(owl)

    expect(owl).toBeChecked()
  })

  it('selects Fire and updates the preview', async () => {
    const { user } = await renderHome()
    const { dialog, iconGroup } = await openFrom(user, emptyStateTrigger())

    await user.click(within(iconGroup).getByRole('radio', { name: 'Fire' }))

    expect(within(iconGroup).getByRole('radio', { name: 'Fire' })).toBeChecked()
    expect(within(iconGroup).getByRole('radio', { name: 'Owl' })).not.toBeChecked()
    expect(previewEmoji(dialog, iconGroup)).toEqual(['🔥'])
  })

  it('moves between icons with the arrow keys', async () => {
    const { user } = await renderHome()
    const { iconGroup } = await openFrom(user, emptyStateTrigger())

    const owl = within(iconGroup).getByRole('radio', { name: 'Owl' })
    await user.click(owl)
    expect(owl).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(within(iconGroup).getByRole('radio', { name: 'Crossed swords' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(owl).toHaveFocus()
  })

  describe.each([
    ['the empty-state button', emptyStateTrigger],
    ['the rail + button', railTrigger],
  ])('opened from %s', (_label, getTrigger) => {
    it.each([
      ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
      [
        'the X button',
        async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) =>
          user.click(within(dialog).getByRole('button', { name: 'Close' })),
      ],
      [
        'Cancel',
        async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) =>
          user.click(within(dialog).getByRole('button', { name: 'Cancel' })),
      ],
    ])('closes on %s and returns focus to the trigger', async (_how, close) => {
      const { user } = await renderHome()
      const trigger = getTrigger()
      const { dialog } = await openFrom(user, trigger)

      await close(user, dialog)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })
  })

  it('resets the form when reopened after closing', async () => {
    const { user } = await renderHome()
    const trigger = emptyStateTrigger()
    const first = await openFrom(user, trigger)
    await user.click(within(first.dialog).getByRole('button', { name: 'Create room' }))
    await within(first.dialog).findByText('Give your room a name')
    await user.type(first.nameInput, 'Night Owls')
    await user.click(within(first.iconGroup).getByRole('radio', { name: 'Fire' }))
    await user.keyboard('{Escape}')

    const second = await openFrom(user, trigger)

    expect(second.nameInput).toHaveValue('')
    expect(second.nameInput).not.toHaveAttribute('aria-invalid', 'true')
    expect(second.nameInput).toHaveAccessibleDescription('0/40 characters')
    expect(within(second.dialog).queryByText('Give your room a name')).not.toBeInTheDocument()
    expect(within(second.iconGroup).getByRole('radio', { name: 'Owl' })).toBeChecked()
  })

  it('closes after a valid submit and returns focus to the trigger', async () => {
    const { user } = await renderHome()
    const trigger = emptyStateTrigger()
    const { dialog, nameInput } = await openFrom(user, trigger)

    await user.type(nameInput, 'Raid Night')
    await user.click(within(dialog).getByRole('button', { name: 'Create room' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
