import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import type { CreateRoomBody, RoomDetail } from '@/features/rooms'
import { toMyRoom } from '@/test/fixtures/rooms'
import { createdRoom, roomsListHandler } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

async function renderHome() {
  const user = userEvent.setup()
  // No rooms yet, so Home shows its empty state with a Create a room button.
  server.use(roomsListHandler([]))
  // The shell reads route params and renders typed Links, so render the real route tree.
  const result = await renderRoute('/')
  // Wait for the (empty) room list so both triggers are on the page.
  await screen.findByRole('heading', { level: 2, name: 'Rooms are private' })
  return { user, ...result }
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

    expect(nameInput).toHaveAccessibleDescription('0/48 characters')

    await user.type(nameInput, 'Night Owls')

    expect(nameInput).toHaveAccessibleDescription('10/48 characters')
  })

  it('stops typing at 48 characters', async () => {
    const { user } = await renderHome()
    const { nameInput } = await openFrom(user, emptyStateTrigger())

    await user.type(nameInput, 'x'.repeat(50))

    expect(nameInput).toHaveValue('x'.repeat(48))
    expect(nameInput).toHaveAccessibleDescription('48/48 characters')
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
    expect(second.nameInput).toHaveAccessibleDescription('0/48 characters')
    expect(within(second.dialog).queryByText('Give your room a name')).not.toBeInTheDocument()
    expect(within(second.iconGroup).getByRole('radio', { name: 'Owl' })).toBeChecked()
  })

  it.each([
    ['the empty-state button', emptyStateTrigger],
    ['the rail + button', railTrigger],
  ])(
    'from %s, creates the room, opens its #general and focuses the heading',
    async (_label, getTrigger) => {
      const bodies: unknown[] = []
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'POST' && new URL(request.url).pathname === '/api/rooms') {
          bodies.push(await request.clone().json())
        }
      })
      const { user, router } = await renderHome()
      // After the create, the list is refetched and now holds the new room (as the API would).
      const created: RoomDetail[] = []
      server.use(
        http.post('*/api/rooms', async ({ request }) => {
          const detail = createdRoom((await request.json()) as CreateRoomBody)
          created.push(detail)
          return HttpResponse.json(detail, { status: 201 })
        }),
        http.get('*/api/rooms', () =>
          HttpResponse.json({ data: created.map(toMyRoom), nextCursor: null }),
        ),
      )
      const { dialog, nameInput, iconGroup } = await openFrom(user, getTrigger())

      await user.type(nameInput, '  Raid Night  ')
      await user.click(within(iconGroup).getByRole('radio', { name: 'Fire' }))
      await user.click(within(dialog).getByRole('button', { name: 'Create room' }))

      const heading = await screen.findByRole('heading', { level: 1, name: 'general' })
      expect(router.state.location.pathname).toMatch(/^\/rooms\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/)
      expect(screen.queryByRole('dialog', { name: 'Create a room' })).not.toBeInTheDocument()
      await vi.waitFor(() => expect(heading).toHaveFocus())
      expect(bodies).toEqual([{ name: 'Raid Night', icon: { kind: 'emoji', emoji: '🔥' } }])
      // The new room joins the rail (and stays after the list refetch).
      const rail = screen.getByRole('navigation', { name: 'Rooms' })
      expect(within(rail).getByRole('link', { name: 'Raid Night' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      server.events.removeAllListeners()
    },
  )

  it('disables Create room while the request is pending', async () => {
    server.use(http.post('*/api/rooms', () => new Promise<never>(() => {})))
    const { user } = await renderHome()
    const { dialog, nameInput } = await openFrom(user, emptyStateTrigger())

    await user.type(nameInput, 'Raid Night')
    await user.click(within(dialog).getByRole('button', { name: 'Create room' }))

    expect(within(dialog).getByRole('button', { name: 'Create room' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('sends one create request when Create room is double-clicked', async () => {
    let posts = 0
    server.use(
      http.post('*/api/rooms', () => {
        posts += 1
        return new Promise<never>(() => {})
      }),
    )
    const { user } = await renderHome()
    const { dialog, nameInput } = await openFrom(user, emptyStateTrigger())

    await user.type(nameInput, 'Raid Night')
    await user.dblClick(within(dialog).getByRole('button', { name: 'Create room' }))

    await vi.waitFor(() => expect(posts).toBeGreaterThan(0))
    expect(within(dialog).getByRole('button', { name: 'Create room' })).toBeDisabled()
    expect(posts).toBe(1)
  })

  it('shows a 422 about the icon on the icon field, not the name', async () => {
    server.use(
      http.post('*/api/rooms', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Invalid room.',
              details: [{ path: 'body.icon.emoji', message: 'Pick one of the listed emoji.' }],
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { user } = await renderHome()
    const { dialog, nameInput } = await openFrom(user, emptyStateTrigger())

    await user.type(nameInput, 'Raid Night')
    await user.click(within(dialog).getByRole('button', { name: 'Create room' }))

    const message = await within(dialog).findByText('Pick one of the listed emoji.')
    const iconField = within(dialog).getByRole('group', { name: 'Icon' })
    expect(iconField).toContainElement(message)
    expect(iconField).toHaveAccessibleDescription(/Pick one of the listed emoji\./)
    expect(nameInput).not.toHaveAttribute('aria-invalid', 'true')
    // A field error, not a form-level alert.
    expect(within(dialog).getAllByRole('alert')).toEqual([message.closest('[role="alert"]')])
  })

  it('shows 422 details on the name field', async () => {
    server.use(
      http.post('*/api/rooms', () =>
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
    const { user } = await renderHome()
    const { dialog, nameInput } = await openFrom(user, emptyStateTrigger())

    await user.type(nameInput, 'Raid Night')
    await user.click(within(dialog).getByRole('button', { name: 'Create room' }))

    expect(await within(dialog).findByText('Use visible characters.')).toBeInTheDocument()
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput).toHaveFocus()
  })

  it('explains the rate limit in the form on 429', async () => {
    server.use(
      http.post('*/api/rooms', () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Slow down.' } },
          { status: 429 },
        ),
      ),
    )
    const { user } = await renderHome()
    const { dialog, nameInput } = await openFrom(user, emptyStateTrigger())

    await user.type(nameInput, 'Raid Night')
    await user.click(within(dialog).getByRole('button', { name: 'Create room' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "You've created several rooms recently. Try again later.",
    )
    expect(within(dialog).getByRole('button', { name: 'Create room' })).toBeEnabled()
  })
})
