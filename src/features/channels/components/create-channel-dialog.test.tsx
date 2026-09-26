import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { isolate } from '@/lib/bidi'
import { apiError, sidebarNames } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { gateRequests, recordRequests } from '@/test/msw/requests'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const CREATE_PATH = '*/api/rooms/:roomId/channels'

type User = ReturnType<typeof userEvent.setup>

async function renderGeneral() {
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(nightOwls, 'general'))
  return { user, ...result }
}

async function openCreate(user: User, trigger: HTMLElement) {
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Create a channel' })
  return {
    dialog,
    nameInput: within(dialog).getByRole('textbox', { name: 'Channel name' }),
    submit: within(dialog).getByRole('button', { name: 'Create channel' }),
    cancel: within(dialog).getByRole('button', { name: 'Cancel' }),
  }
}

describe('CreateChannelDialog from the sidebar', () => {
  it('creates a text channel, opens it and focuses its heading', async () => {
    const posts = recordRequests('post', CREATE_PATH)
    const { user, router } = await renderGeneral()
    const { nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create text channel' }),
    )
    expect(nameInput).toHaveFocus()

    await user.type(nameInput, 'memes')
    await user.click(submit)

    const heading = await screen.findByRole('heading', { level: 1, name: 'memes' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.queryByRole('dialog', { name: 'Create a channel' })).not.toBeInTheDocument()
    expect(posts.bodies).toEqual([{ type: 'text', name: 'memes' }])
    expect(router.state.location.pathname).toMatch(new RegExp(`^${roomPath(nightOwls)}/[0-9a-f-]{36}$`))
    expect(router.state.location.pathname).not.toBe(roomPath(nightOwls, 'general'))
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning', 'memes'])
  })

  it('creates a voice channel without leaving the current channel', async () => {
    const posts = recordRequests('post', CREATE_PATH)
    const { user, router } = await renderGeneral()
    const trigger = screen.getByRole('button', { name: 'Create voice channel' })
    const { dialog, nameInput, submit } = await openCreate(user, trigger)
    expect(within(dialog).getByRole('radio', { name: /Voice/ })).toBeChecked()

    await user.type(nameInput, 'afk')
    await user.click(submit)

    expect(await screen.findByText(`Created #${isolate('afk')}`)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Create a channel' })).not.toBeInTheDocument()
    expect(posts.bodies).toEqual([{ type: 'voice', name: 'afk' }])
    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(sidebarNames('Voice channels')).toEqual(['voice', 'late night', 'afk'])
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('puts CHANNEL_NAME_TAKEN from the API on the name field', async () => {
    server.use(
      http.post(CREATE_PATH, () =>
        apiError(409, 'CHANNEL_NAME_TAKEN', 'A text channel with that name already exists.'),
      ),
    )
    const { user } = await renderGeneral()
    const { dialog, nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create text channel' }),
    )

    await user.type(nameInput, 'memes')
    await user.click(submit)

    await waitFor(() => expect(nameInput).toHaveAttribute('aria-invalid', 'true'))
    expect(nameInput).toHaveAccessibleDescription(expect.stringContaining("There's already a channel called that."))
    expect(nameInput).toHaveFocus()
    expect(dialog).toBeInTheDocument()
    expect(submit).toBeEnabled()
  })

  it('catches a name already used by a channel of the same type before calling the API', async () => {
    const posts = recordRequests('post', CREATE_PATH)
    const { user } = await renderGeneral()
    const { nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create text channel' }),
    )

    await user.type(nameInput, 'Clips')
    await user.click(submit)

    await waitFor(() =>
      expect(nameInput).toHaveAccessibleDescription(expect.stringContaining("There's already a channel called that.")),
    )
    expect(posts.count).toBe(0)
  })

  it('shows a 422 validation message for body.name on the name field', async () => {
    server.use(
      http.post(CREATE_PATH, () =>
        apiError(422, 'VALIDATION_FAILED', 'Invalid request.', [
          { path: 'body.name', message: 'That name is reserved.' },
        ]),
      ),
    )
    const { user } = await renderGeneral()
    const { nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create text channel' }),
    )

    await user.type(nameInput, 'admin')
    await user.click(submit)

    await waitFor(() =>
      expect(nameInput).toHaveAccessibleDescription(expect.stringContaining('That name is reserved.')),
    )
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows CHANNEL_LIMIT_REACHED as a form message', async () => {
    server.use(
      http.post(CREATE_PATH, () => apiError(409, 'CHANNEL_LIMIT_REACHED', 'Too many channels.')),
    )
    const { user } = await renderGeneral()
    const { dialog, nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create text channel' }),
    )

    await user.type(nameInput, 'memes')
    await user.click(submit)

    expect(
      await within(dialog).findByText('This room has the maximum of 50 channels.'),
    ).toBeInTheDocument()
    expect(nameInput).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the offline message when the request never reaches the API', async () => {
    server.use(http.post(CREATE_PATH, () => HttpResponse.error()))
    const { user } = await renderGeneral()
    const { dialog, nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create text channel' }),
    )

    await user.type(nameInput, 'memes')
    await user.click(submit)

    expect(
      await within(dialog).findByText("Couldn't reach Hideout. Check your connection and try again."),
    ).toBeInTheDocument()
  })

  it('sends one request when Create channel is double-clicked', async () => {
    const posts = gateRequests('post', CREATE_PATH)
    const { user } = await renderGeneral()
    const { nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create voice channel' }),
    )
    await user.type(nameInput, 'afk')

    await user.dblClick(submit)
    await waitFor(() => expect(posts.count).toBe(1))
    posts.releaseAll()

    expect(await screen.findByText(`Created #${isolate('afk')}`)).toBeInTheDocument()
    expect(posts.count).toBe(1)
    expect(sidebarNames('Voice channels')).toEqual(['voice', 'late night', 'afk'])
  })

  // Validation is async, so two submits can both pass it before the button disables (e.g. a
  // fast double Enter). Creating a channel isn't idempotent.
  it('sends one request when the form is submitted twice before it disables', async () => {
    const posts = gateRequests('post', CREATE_PATH)
    const { user } = await renderGeneral()
    const { nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create voice channel' }),
    )
    await user.type(nameInput, 'afk')
    const form = submit.closest('form')
    if (!form) throw new Error('no form')

    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })
    await waitFor(() => expect(posts.count).toBe(1))
    posts.releaseAll()

    expect(await screen.findByText(`Created #${isolate('afk')}`)).toBeInTheDocument()
    expect(posts.count).toBe(1)
    expect(sidebarNames('Voice channels')).toEqual(['voice', 'late night', 'afk'])
  })

  it('disables Create and Cancel, and stays open on Escape, while the channel is being created', async () => {
    const posts = gateRequests('post', CREATE_PATH)
    const { user } = await renderGeneral()
    const { dialog, nameInput, submit, cancel } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create voice channel' }),
    )
    await user.type(nameInput, 'afk')

    await user.click(submit)
    await waitFor(() => expect(posts.waiting).toBe(1))

    expect(submit).toBeDisabled()
    expect(cancel).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: /Text/ })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Create a channel' })).toBeInTheDocument()

    posts.releaseAll()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create a channel' })).not.toBeInTheDocument(),
    )
  })
})

describe('CreateChannelDialog when the API refuses', () => {
  it('on 403: toasts, closes and refetches the room', async () => {
    server.use(http.post(CREATE_PATH, () => apiError(403, 'FORBIDDEN', 'Not allowed.')))
    const { user } = await renderGeneral()
    const roomGets = recordRequests('get', `*/api/rooms/${nightOwls.room.id}`)
    const { nameInput, submit } = await openCreate(
      user,
      screen.getByRole('button', { name: 'Create text channel' }),
    )

    await user.type(nameInput, 'memes')
    await user.click(submit)

    expect(await screen.findByText('Only owners and admins can manage channels.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create a channel' })).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(roomGets.count).toBe(1))
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })
})

describe('CreateChannelDialog from Room settings', () => {
  it('stays in settings and toasts "Created #name" for a text channel', async () => {
    const user = userEvent.setup()
    const settingsPath = `${roomPath(nightOwls)}/settings`
    const { router } = await renderRoute(`${settingsPath}?section=channels`)
    const textGroup = screen.getByRole('region', { name: 'Text channels' })

    const { nameInput, submit } = await openCreate(
      user,
      within(textGroup).getByRole('button', { name: 'Create channel' }),
    )
    await user.type(nameInput, 'memes')
    await user.click(submit)

    expect(await screen.findByText(`Created #${isolate('memes')}`)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(settingsPath)
    const list = within(textGroup).getByRole('list', { name: 'Text channels' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'general',
      'clips',
      'planning',
      'memes',
    ])
  })
})
