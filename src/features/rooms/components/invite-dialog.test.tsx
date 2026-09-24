import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const INVITE_URL = 'https://hideout.gg/i/7Hq2xK'

async function openInvite() {
  // userEvent.setup() installs a clipboard stub on navigator.clipboard for this test.
  const user = userEvent.setup()
  await renderRoute('/rooms/night-owls/general')
  const trigger = screen.getByRole('button', { name: 'Invite' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })
  return { user, trigger, dialog }
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  select: string,
  option: string,
) {
  await user.click(within(dialog).getByRole('combobox', { name: select }))
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('InviteDialog', () => {
  it('opens from the header Invite button on the Invite link tab', async () => {
    const { dialog } = await openInvite()

    expect(dialog).toHaveAccessibleDescription(
      'Share an invite link or invite a Steam user directly.',
    )
    expect(within(dialog).getByRole('tab', { name: 'Invite link' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(dialog).getByRole('textbox', { name: 'Invite link' })).toHaveValue(INVITE_URL)
  })

  it('switches to the Steam user tab, which has a labelled input', async () => {
    const { user, dialog } = await openInvite()

    await user.click(within(dialog).getByRole('tab', { name: 'Invite a Steam user' }))

    expect(within(dialog).getByRole('tab', { name: 'Invite a Steam user' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const input = within(dialog).getByRole('textbox', { name: 'Steam profile URL or friend name' })
    expect(input).toHaveAccessibleDescription(
      "They'll see the invite in Hideout next time they sign in with Steam.",
    )
    expect(within(dialog).getByRole('button', { name: 'Send invite' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox', { name: 'Invite link' })).not.toBeInTheDocument()
  })

  it('switches tabs with the arrow keys', async () => {
    const { user, dialog } = await openInvite()

    await user.click(within(dialog).getByRole('tab', { name: 'Invite link' }))
    await user.keyboard('{ArrowRight}')

    expect(within(dialog).getByRole('tab', { name: 'Invite a Steam user' })).toHaveFocus()
    expect(
      within(dialog).getByRole('textbox', { name: 'Steam profile URL or friend name' }),
    ).toBeInTheDocument()
  })

  it('copies the link to the clipboard and confirms with a toast', async () => {
    const { user, dialog } = await openInvite()

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }))

    expect(await screen.findByText('Invite link copied')).toBeInTheDocument()
    await expect(navigator.clipboard.readText()).resolves.toBe(INVITE_URL)
  })

  it('shows an error toast with a manual fallback when the clipboard rejects', async () => {
    const { user, dialog } = await openInvite()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'))

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }))

    expect(await screen.findByText("Couldn't copy the invite link")).toBeInTheDocument()
    expect(screen.getByText('Select the link and copy it manually.')).toBeInTheDocument()
    expect(screen.queryByText('Invite link copied')).not.toBeInTheDocument()
  })

  it('describes the default link: expires or reaches 1 use', async () => {
    const { dialog } = await openInvite()

    expect(within(dialog).getByRole('combobox', { name: 'Expire after' })).toHaveTextContent('1 hour')
    expect(within(dialog).getByRole('combobox', { name: 'Max uses' })).toHaveTextContent('1')
    expect(within(dialog).getByRole('textbox', { name: 'Invite link' })).toHaveAccessibleDescription(
      'Anyone with this link can join Night Owls until it expires or reaches 1 use. You can revoke it any time in Room settings.',
    )
  })

  it('updates the helper text when Expire after and Max uses change', async () => {
    const { user, dialog } = await openInvite()
    const link = within(dialog).getByRole('textbox', { name: 'Invite link' })

    await choose(user, dialog, 'Max uses', '25')
    expect(link).toHaveAccessibleDescription(/until it expires or reaches 25 uses\./)

    await choose(user, dialog, 'Expire after', 'Never')
    expect(link).toHaveAccessibleDescription(/can join Night Owls until it reaches 25 uses\./)

    await choose(user, dialog, 'Max uses', 'No limit')
    expect(link).toHaveAccessibleDescription(
      'Anyone with this link can join Night Owls. It never expires and has no use limit. You can revoke it any time in Room settings.',
    )

    await choose(user, dialog, 'Expire after', '7 days')
    expect(link).toHaveAccessibleDescription(/can join Night Owls until it expires\./)
  })

  it('closes on Escape and returns focus to the Invite button', async () => {
    const { user, trigger } = await openInvite()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on Done and returns focus to the Invite button', async () => {
    const { user, trigger, dialog } = await openInvite()

    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes a select with Escape without closing the dialog', async () => {
    const { user, dialog } = await openInvite()

    await user.click(within(dialog).getByRole('combobox', { name: 'Expire after' }))
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Invite people to Night Owls' })).toBeInTheDocument()
  })
})
