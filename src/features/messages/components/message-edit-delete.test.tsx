import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { apiError } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { messageId, people, todayAt } from '@/test/fixtures/messages'
import { channelOf, nightOwls, raidNight, rockAndStone, roomPath } from '@/test/fixtures/rooms'
import { messageHandlers } from '@/test/msw/messages'
import { recordRequests } from '@/test/msw/requests'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import type { RoomDetail } from '@/features/rooms'
import type { Message, MessagePage } from '../types'

failOnConsoleError()

const PATCH = '*/api/messages/:messageId'
const DELETE = '*/api/messages/:messageId'

function memberNamed(room: RoomDetail, displayName: string) {
  const member = room.members.find((item) => item.user.displayName === displayName)
  if (!member) throw new Error(`${room.room.name} has no member ${displayName}`)
  return member.user
}

/** A message by someone else, then your own, in `room`'s first text channel. */
function conversation(room: RoomDetail, channelName: string, otherName: string) {
  const channelId = channelOf(room, channelName).id
  const theirs: Message = {
    id: messageId(301),
    channelId,
    author: memberNamed(room, otherName),
    body: 'sounds good',
    createdAt: todayAt(20, 0),
    editedAt: null,
  }
  const mine: Message = {
    id: messageId(302),
    channelId,
    author: people.me,
    body: 'meet at 9',
    createdAt: todayAt(20, 1),
    editedAt: null,
  }
  return { channelId, theirs, mine, messages: [theirs, mine] }
}

async function openChannel(room: RoomDetail, channelName: string, otherName: string) {
  const setup = conversation(room, channelName, otherName)
  server.use(...messageHandlers({ [setup.channelId]: setup.messages }))
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(room, channelName))
  const log = screen.getByRole('log', { name: `Messages in #${channelName}` })
  return { ...result, ...setup, user, log }
}

function messageRow(log: HTMLElement, text: string) {
  return within(log).queryByText(text)?.closest<HTMLElement>('[role="article"]') ?? null
}

function rowOf(log: HTMLElement, text: string) {
  const row = messageRow(log, text)
  if (!row) throw new Error(`No message row for "${text}"`)
  return row
}

async function startEditingOwn(user: ReturnType<typeof userEvent.setup>, log: HTMLElement) {
  await user.click(within(rowOf(log, 'meet at 9')).getByRole('button', { name: 'Edit message' }))
  const editor = await within(log).findByRole('textbox', { name: 'Edit message' })
  await user.clear(editor)
  return editor
}

describe('editing a message', () => {
  it('offers Edit only on your own message', async () => {
    const { log } = await openChannel(nightOwls, 'general', 'Maya')

    expect(within(rowOf(log, 'sounds good')).queryByRole('button', { name: 'Edit message' })).toBeNull()
    expect(within(rowOf(log, 'meet at 9')).getByRole('button', { name: 'Edit message' })).toBeInTheDocument()
  })

  it('saves with Enter and marks the message (edited)', async () => {
    const { user, log } = await openChannel(nightOwls, 'general', 'Maya')
    const patches = recordRequests('patch', PATCH)

    const editor = await startEditingOwn(user, log)
    await user.type(editor, 'meet at 10{Enter}')

    await waitFor(() => expect(rowOf(log, 'meet at 10')).toHaveTextContent('(edited)'))
    expect(within(log).queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
    expect(patches.bodies).toEqual([{ body: 'meet at 10' }])
    expect(rowOf(log, 'meet at 10')).toHaveFocus()
  })

  it('on 422, reopens the editor with your text and the reason inline', async () => {
    const { user, log } = await openChannel(nightOwls, 'general', 'Maya')
    server.use(
      http.patch(PATCH, () =>
        apiError(422, 'VALIDATION_FAILED', 'Invalid body.', [
          { path: 'body.body', message: 'That message is too long.' },
        ]),
      ),
    )

    const editor = await startEditingOwn(user, log)
    await user.type(editor, 'meet at 10{Enter}')

    const reopened = await within(log).findByRole('textbox', { name: 'Edit message' })
    expect(reopened).toHaveValue('meet at 10')
    await waitFor(() => expect(reopened).toBeInvalid())
    expect(reopened).toHaveAccessibleDescription(/That message is too long\./)
  })

  it('on 429, keeps the editor open with your text and says to slow down', async () => {
    const { user, log } = await openChannel(nightOwls, 'general', 'Maya')
    server.use(http.patch(PATCH, () => apiError(429, 'RATE_LIMITED', 'Slow down.')))

    const editor = await startEditingOwn(user, log)
    await user.type(editor, 'meet at 10{Enter}')

    expect(
      await screen.findByText("You're sending too fast. Wait a moment and try again."),
    ).toBeInTheDocument()
    expect(within(log).getByRole('textbox', { name: 'Edit message' })).toHaveValue('meet at 10')
  })

  it('on 404, removes the message and says it was deleted', async () => {
    const { user, log } = await openChannel(nightOwls, 'general', 'Maya')
    server.use(http.patch(PATCH, () => apiError(404, 'NOT_FOUND', 'Message not found.')))

    const editor = await startEditingOwn(user, log)
    await user.type(editor, 'meet at 10{Enter}')

    expect(await screen.findByText('That message was deleted.')).toBeInTheDocument()
    await waitFor(() => expect(messageRow(log, 'meet at 10')).toBeNull())
    expect(messageRow(log, 'meet at 9')).toBeNull()
    expect(within(log).queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
  })
})

describe('deleting a message', () => {
  it('a plain member can delete only their own messages', async () => {
    const { user, log } = await openChannel(rockAndStone, 'general', 'Maya')

    expect(within(log).getAllByRole('button', { name: 'Delete message' })).toHaveLength(1)
    expect(within(rowOf(log, 'meet at 9')).getByRole('button', { name: 'Delete message' })).toBeInTheDocument()
    expect(within(rowOf(log, 'sounds good')).queryByRole('toolbar')).toBeNull()

    await user.pointer({ keys: '[MouseRight]', target: rowOf(log, 'sounds good') })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it("an admin can delete someone else's message, but not edit it", async () => {
    const { user, log } = await openChannel(raidNight, 'lobby', 'Theo')
    const theirs = rowOf(log, 'sounds good')

    expect(within(theirs).getByRole('button', { name: 'Delete message' })).toBeInTheDocument()
    expect(within(theirs).queryByRole('button', { name: 'Edit message' })).toBeNull()

    await user.click(within(theirs).getByRole('button', { name: 'Delete message' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete message' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(messageRow(log, 'sounds good')).toBeNull()
  })

  it('treats a 404 (already deleted) as done', async () => {
    const { user, log } = await openChannel(nightOwls, 'general', 'Maya')
    server.use(http.delete(DELETE, () => apiError(404, 'NOT_FOUND', 'Message not found.')))

    await user.click(within(rowOf(log, 'meet at 9')).getByRole('button', { name: 'Delete message' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete message' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(messageRow(log, 'meet at 9')).toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('on failure, puts the message back and explains in the dialog; Cancel returns focus to it', async () => {
    const { user, log, queryClient, channelId } = await openChannel(nightOwls, 'general', 'Maya')
    server.use(http.delete(DELETE, () => apiError(500, 'INTERNAL', 'Boom.')))

    await user.click(within(rowOf(log, 'meet at 9')).getByRole('button', { name: 'Delete message' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this message?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Delete message' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't delete the message. Try again.",
    )
    expect(within(dialog).getByRole('button', { name: 'Delete message' })).toBeEnabled()
    expect(messageRow(log, 'meet at 9')).not.toBeNull()
    const cached = queryClient.getQueryData<{ pages: MessagePage[] }>(['messages', channelId.toLowerCase()])
    expect(cached?.pages.flatMap((page) => page.data.map((item) => item.body))).toContain('meet at 9')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(rowOf(log, 'meet at 9')).toHaveFocus())
  })
})
