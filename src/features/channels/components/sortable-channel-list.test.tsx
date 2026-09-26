import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi, type MockInstance } from 'vitest'
import { removeChannel, upsertChannel } from '@/features/rooms'
import { isolate } from '@/lib/bidi'
import { apiError, channelNav, chooseChannelAction, sidebarNames } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { gateRequests, recordRequests } from '@/test/msw/requests'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const ORDER_PATH = '*/api/rooms/:roomId/channels/order'
const ROOM_GET = `*/api/rooms/${nightOwls.room.id}`
const ids = (...names: string[]) => names.map((name) => channelOf(nightOwls, name).id)

async function renderGeneral() {
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(nightOwls, 'general'))
  return { user, ...result }
}

async function menuItems(user: ReturnType<typeof userEvent.setup>, channelName: string) {
  await user.click(
    within(channelNav()).getByRole('button', { name: `Channel options for #${channelName}` }),
  )
  const menu = await screen.findByRole('menu')
  const item = (name: string) => within(menu).getByRole('menuitem', { name })
  return { menu, moveUp: item('Move up'), moveDown: item('Move down') }
}

describe('Reordering channels from the sidebar', () => {
  it('Move down sends one PUT with the full text order, top first, and updates the sidebar', async () => {
    const puts = recordRequests('put', ORDER_PATH)
    const { user } = await renderGeneral()

    await chooseChannelAction(user, 'general', 'Move down')

    expect(sidebarNames('Text channels')).toEqual(['clips', 'general', 'planning'])
    await waitFor(() => expect(puts.count).toBe(1))
    expect(puts.bodies[0]).toEqual({ type: 'text', channelIds: ids('clips', 'general', 'planning') })
    expect(sidebarNames('Voice channels')).toEqual(['voice', 'late night'])
  })

  it('Move up on a voice channel sends the voice order', async () => {
    const puts = recordRequests('put', ORDER_PATH)
    const { user } = await renderGeneral()

    await chooseChannelAction(user, 'late night', 'Move up')

    expect(sidebarNames('Voice channels')).toEqual(['late night', 'voice'])
    await waitFor(() => expect(puts.count).toBe(1))
    expect(puts.bodies[0]).toEqual({ type: 'voice', channelIds: ids('late night', 'voice') })
  })

  it('disables Move up on the first channel and Move down on the last', async () => {
    const { user } = await renderGeneral()

    const first = await menuItems(user, 'general')
    expect(first.moveUp).toHaveAttribute('aria-disabled', 'true')
    expect(first.moveDown).not.toHaveAttribute('aria-disabled')
    await user.keyboard('{Escape}')

    const middle = await menuItems(user, 'clips')
    expect(middle.moveUp).not.toHaveAttribute('aria-disabled')
    expect(middle.moveDown).not.toHaveAttribute('aria-disabled')
    await user.keyboard('{Escape}')

    const last = await menuItems(user, 'planning')
    expect(last.moveUp).not.toHaveAttribute('aria-disabled')
    expect(last.moveDown).toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('{Escape}')

    const lastVoice = await menuItems(user, 'late night')
    expect(lastVoice.moveDown).toHaveAttribute('aria-disabled', 'true')
  })

  it('on 409 CHANNEL_ORDER_STALE: restores the order, toasts and refetches the room', async () => {
    server.use(
      http.put(ORDER_PATH, () =>
        apiError(409, 'CHANNEL_ORDER_STALE', 'The channel list is out of date.'),
      ),
    )
    const { user } = await renderGeneral()
    const roomGets = recordRequests('get', ROOM_GET)

    await chooseChannelAction(user, 'general', 'Move down')

    expect(await screen.findByText('The channel list changed. Try again.')).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
    await waitFor(() => expect(roomGets.count).toBe(1))
  })

  it('on 429: restores the order and toasts', async () => {
    server.use(http.put(ORDER_PATH, () => apiError(429, 'RATE_LIMITED', 'Slow down.')))
    const { user } = await renderGeneral()

    await chooseChannelAction(user, 'clips', 'Move up')

    expect(
      await screen.findByText('Too many channel changes. Try again later.'),
    ).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })

  it('when offline: restores the order and says it could not reach Hideout', async () => {
    server.use(http.put(ORDER_PATH, () => HttpResponse.error()))
    const { user } = await renderGeneral()

    await chooseChannelAction(user, 'general', 'Move down')

    expect(
      await screen.findByText("Couldn't reach Hideout. Check your connection and try again."),
    ).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
  })

  it('on 403: restores the order, toasts and refetches the room', async () => {
    server.use(http.put(ORDER_PATH, () => apiError(403, 'FORBIDDEN', 'Not allowed.')))
    const { user } = await renderGeneral()
    const roomGets = recordRequests('get', ROOM_GET)

    await chooseChannelAction(user, 'general', 'Move down')

    expect(await screen.findByText('Only owners and admins can manage channels.')).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
    await waitFor(() => expect(roomGets.count).toBe(1))
  })

  it('serializes two quick moves (never two PUTs in flight) and ends with the final order', async () => {
    const puts = gateRequests('put', ORDER_PATH)
    const { user } = await renderGeneral()

    await chooseChannelAction(user, 'general', 'Move down')
    await waitFor(() => expect(puts.waiting).toBe(1))
    await chooseChannelAction(user, 'general', 'Move down')

    // Both moves show at once; the second PUT waits for the first.
    expect(sidebarNames('Text channels')).toEqual(['clips', 'planning', 'general'])
    expect(puts.count).toBe(1)

    puts.releaseNext()
    await waitFor(() => expect(puts.count).toBe(2))
    expect(puts.waiting).toBe(1)
    expect(sidebarNames('Text channels')).toEqual(['clips', 'planning', 'general'])
    puts.releaseAll()

    expect(puts.maxWaiting).toBe(1)
    expect(puts.bodies).toEqual([
      { type: 'text', channelIds: ids('clips', 'general', 'planning') },
      { type: 'text', channelIds: ids('clips', 'planning', 'general') },
    ])
    await waitFor(() => expect(puts.waiting).toBe(0))
    // The last response is applied and matches what's on screen.
    await waitFor(() =>
      expect(sidebarNames('Text channels')).toEqual(['clips', 'planning', 'general']),
    )
  })

  it('when the first of two queued moves fails, restores the order the server last confirmed', async () => {
    let calls = 0
    server.use(
      http.put(ORDER_PATH, () => {
        calls += 1
        return calls === 1 ? undefined : apiError(429, 'RATE_LIMITED', 'Slow down.')
      }),
    )
    const puts = gateRequests('put', ORDER_PATH)
    const { user } = await renderGeneral()

    await chooseChannelAction(user, 'general', 'Move down')
    await waitFor(() => expect(puts.waiting).toBe(1))
    await chooseChannelAction(user, 'general', 'Move down')
    puts.releaseAll()

    expect(
      await screen.findByText('Too many channel changes. Try again later.'),
    ).toBeInTheDocument()
    // The first move was confirmed; only the failed second one is undone.
    await waitFor(() =>
      expect(sidebarNames('Text channels')).toEqual(['clips', 'general', 'planning']),
    )
    expect(puts.count).toBe(2)
  })

  it('applies only the order from the response: channels deleted, created or renamed meanwhile stay as they are', async () => {
    const puts = gateRequests('put', ORDER_PATH)
    const { user, queryClient } = await renderGeneral()
    const roomId = nightOwls.room.id

    await chooseChannelAction(user, 'general', 'Move down')
    await waitFor(() => expect(puts.waiting).toBe(1))
    expect(sidebarNames('Text channels')).toEqual(['clips', 'general', 'planning'])

    // While the PUT is in flight (as realtime would): one reordered channel is deleted, another
    // renamed, and a new one created at the end.
    act(() => {
      removeChannel(queryClient, roomId, channelOf(nightOwls, 'clips').id)
      upsertChannel(queryClient, roomId, { ...channelOf(nightOwls, 'planning'), name: 'plans' })
      upsertChannel(queryClient, roomId, {
        id: 'd9000000-0000-4000-8000-000000000001',
        roomId,
        type: 'text',
        name: 'memes',
        position: 3,
      })
    })
    await waitFor(() =>
      expect(sidebarNames('Text channels')).toEqual(['general', 'plans', 'memes']),
    )

    // The response still lists #clips (deleted) and #planning (old name), and not #memes.
    puts.releaseAll()
    await waitFor(() => expect(puts.waiting).toBe(0))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sidebarNames('Text channels')).toEqual(['general', 'plans', 'memes'])
    expect(within(channelNav()).queryByRole('link', { name: 'clips' })).not.toBeInTheDocument()
  })
})

describe('Reordering channels in Room settings', () => {
  it('Move down sends one PUT and keeps focus on the moved row', async () => {
    const puts = recordRequests('put', ORDER_PATH)
    const user = userEvent.setup()
    await renderRoute(`${roomPath(nightOwls)}/settings?section=channels`)
    const text = screen.getByRole('list', { name: 'Text channels' })

    await user.click(within(text).getByRole('button', { name: 'Move general down' }))

    expect(within(text).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'clips',
      'general',
      'planning',
    ])
    await waitFor(() => expect(puts.count).toBe(1))
    expect(puts.bodies[0]).toEqual({ type: 'text', channelIds: ids('clips', 'general', 'planning') })
    await waitFor(() =>
      expect(within(text).getByRole('button', { name: 'Move general down' })).toHaveFocus(),
    )
  })

  it('disables Move up on the first channel and Move down on the last', async () => {
    await renderRoute(`${roomPath(nightOwls)}/settings?section=channels`)

    expect(screen.getByRole('button', { name: 'Move general up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move general down' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move planning down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move voice up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move late night down' })).toBeDisabled()
  })
})

/**
 * jsdom has no layout, and dnd-kit's keyboard sensor moves by comparing element rects. Give
 * every list row a rect from its list and index (32px rows, lists 1000px apart).
 */
function stubRowGeometry() {
  let spy: MockInstance<Element['getBoundingClientRect']>
  beforeEach(() => {
    spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const row = this.closest('li')
      const list = row?.parentElement
      if (!row || !list) return new DOMRect(0, 0, 0, 0)
      const listIndex = Array.from(document.querySelectorAll('ul')).indexOf(list as HTMLUListElement)
      const rowIndex = Array.from(list.children).indexOf(row)
      return new DOMRect(0, listIndex * 1000 + rowIndex * 32, 200, 32)
    })
  })
  afterEach(() => spy.mockRestore())
}

/** dnd-kit's keyboard sensor adds its keydown listener on the next task after picking up. */
async function nextTask() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('Reordering channels by keyboard drag on the grip', () => {
  stubRowGeometry()

  it('Space, ArrowDown, Space moves the channel, announces each step and sends one PUT', async () => {
    const puts = recordRequests('put', ORDER_PATH)
    await renderRoute(roomPath(nightOwls, 'general'))
    const grip = within(channelNav()).getByRole('button', { name: 'Reorder #general' })
    act(() => grip.focus())

    fireEvent.keyDown(grip, { code: 'Space', key: ' ' })
    await waitFor(() => expect(grip).toHaveAttribute('aria-pressed', 'true'))
    await nextTask()
    fireEvent.keyDown(document, { code: 'ArrowDown', key: 'ArrowDown' })
    expect(await screen.findByText(`Moved #${isolate('general')} to position 2 of 3.`)).toBeInTheDocument()
    fireEvent.keyDown(document, { code: 'Space', key: ' ' })

    expect(await screen.findByText(`Dropped #${isolate('general')} at position 2 of 3.`)).toBeInTheDocument()
    expect(grip).not.toHaveAttribute('aria-pressed', 'true')
    expect(sidebarNames('Text channels')).toEqual(['clips', 'general', 'planning'])
    await waitFor(() => expect(puts.count).toBe(1))
    expect(puts.bodies[0]).toEqual({ type: 'text', channelIds: ids('clips', 'general', 'planning') })
  })

  it('Escape cancels the drag without a request', async () => {
    const puts = recordRequests('put', ORDER_PATH)
    await renderRoute(roomPath(nightOwls, 'general'))
    const grip = within(channelNav()).getByRole('button', { name: 'Reorder #general' })
    act(() => grip.focus())

    fireEvent.keyDown(grip, { code: 'Space', key: ' ' })
    await waitFor(() => expect(grip).toHaveAttribute('aria-pressed', 'true'))
    await nextTask()
    fireEvent.keyDown(document, { code: 'ArrowDown', key: 'ArrowDown' })
    await screen.findByText(`Moved #${isolate('general')} to position 2 of 3.`)
    fireEvent.keyDown(document, { code: 'Escape', key: 'Escape' })

    expect(await screen.findByText(`Cancelled. #${isolate('general')} stays at position 1 of 3.`)).toBeInTheDocument()
    expect(sidebarNames('Text channels')).toEqual(['general', 'clips', 'planning'])
    expect(puts.count).toBe(0)
  })
})
