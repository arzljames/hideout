import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { apiError } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { generalMessages } from '@/test/fixtures/messages'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { messageHandlers } from '@/test/msw/messages'
import { recordRequests } from '@/test/msw/requests'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const generalId = channelOf(nightOwls, 'general').id

async function renderGeneral() {
  server.use(...messageHandlers({ [generalId]: generalMessages }))
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(nightOwls, 'general'))
  const log = await screen.findByRole('log', { name: 'Messages in #general' })
  await within(log).findByText('Same, joining now')
  const composer = screen.getByRole('textbox', { name: 'Message #general' })
  return { ...result, user, log, composer }
}

describe('message flows', () => {
  it('shows a failed send with its reason, and Retry resends with the same key', async () => {
    const { user, log, composer } = await renderGeneral()
    let fail = true
    const keys: (string | null)[] = []
    server.use(
      http.post('*/api/channels/:channelId/messages', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'))
        if (fail) return apiError(403, 'ORIGIN_NOT_ALLOWED', 'Nope.')
        return undefined
      }),
    )

    await user.type(composer, 'gg{Enter}')

    expect(await screen.findByText(/Couldn't send/)).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await vi.waitFor(() => expect(screen.queryByText(/Couldn't send/)).not.toBeInTheDocument())
    expect(within(log).getByText('gg')).toBeInTheDocument()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{1,128}$/)
    expect(keys[1]).toBe(keys[0])
  })

  it('puts a failed message back in the composer with Edit', async () => {
    const { user, composer } = await renderGeneral()
    server.use(
      http.post('*/api/channels/:channelId/messages', () =>
        apiError(422, 'VALIDATION_FAILED', 'Invalid body.', [
          { path: 'body.body', message: 'Too long.' },
        ]),
      ),
    )

    await user.type(composer, 'gg{Enter}')
    expect(await screen.findByText(/Too long\./)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(composer).toHaveValue('gg')
    expect(composer).toHaveFocus()
    expect(screen.queryByText(/Couldn't send/)).not.toBeInTheDocument()
  })

  it('edits your last message from an empty composer with ArrowUp', async () => {
    const { user, log, composer } = await renderGeneral()
    const patches = recordRequests('patch', '*/api/messages/:messageId')

    await user.click(composer)
    await user.keyboard('{ArrowUp}')
    const editor = await within(log).findByRole('textbox', { name: 'Edit message' })
    expect(editor).toHaveFocus()
    expect(editor).toHaveValue('Same, joining now')

    await user.clear(editor)
    await user.type(editor, 'Joining in 5{Enter}')

    expect(within(log).queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
    expect(await within(log).findByText('Joining in 5')).toBeInTheDocument()
    await vi.waitFor(() => expect(patches.bodies).toEqual([{ body: 'Joining in 5' }]))
  })

  it('cancels an edit with Escape and returns focus to the message', async () => {
    const { user, log } = await renderGeneral()
    const own = within(log).getByText('Same, joining now').closest<HTMLElement>('[role="article"]')!

    await user.click(within(own).getByRole('button', { name: 'Edit message' }))
    await within(log).findByRole('textbox', { name: 'Edit message' })
    await user.keyboard('{Escape}')

    expect(within(log).queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
    await vi.waitFor(() =>
      expect(within(log).getByText('Same, joining now').closest('[role="article"]')).toHaveFocus(),
    )
  })

  it('deletes a message after confirming', async () => {
    const { user, log } = await renderGeneral()
    const row = within(log).getByText('In. Give me 20 minutes.').closest<HTMLElement>('[role="article"]')!

    await user.click(within(row).getByRole('button', { name: 'Delete message' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Delete message' }))

    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(log).queryByText('In. Give me 20 minutes.')).not.toBeInTheDocument()
  })

  it('shows "Messages didn\'t load" with Retry when the history fails', async () => {
    server.use(
      http.get('*/api/channels/:channelId/messages', () =>
        apiError(429, 'RATE_LIMITED', 'Slow down.'),
      ),
    )
    await renderRoute(roomPath(nightOwls, 'general'))

    expect(
      await screen.findByRole('heading', { level: 2, name: "Messages didn't load" }),
    ).toBeInTheDocument()
    expect(screen.getByText('Too many requests. Wait a moment and try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    // The channel page itself still works.
    expect(screen.getByRole('textbox', { name: 'Message #general' })).toBeInTheDocument()
  })
})
