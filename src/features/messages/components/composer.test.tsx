import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

async function renderComposer() {
  const user = userEvent.setup()
  await renderRoute('/rooms/night-owls/general')
  const composer = screen.getByRole('textbox', { name: 'Message #general' })
  return { user, composer }
}

describe('Composer', () => {
  it('is labelled with the channel and described by the hint and counter', async () => {
    const { composer } = await renderComposer()

    expect(composer).toHaveAttribute('placeholder', 'Message #general')
    expect(composer).toHaveAccessibleDescription(
      'Enter to send · Shift+Enter for a new line 0 / 2000 characters',
    )
  })

  it('updates the counter as you type', async () => {
    const { user, composer } = await renderComposer()

    await user.type(composer, 'Night Owls')

    expect(composer).toHaveAccessibleDescription(/10 \/ 2000 characters$/)
  })

  it('sends on Enter and clears the text', async () => {
    const { user, composer } = await renderComposer()

    await user.type(composer, 'on my way{Enter}')

    expect(composer).toHaveValue('')
    expect(composer).toHaveAccessibleDescription(/0 \/ 2000 characters$/)
    expect(composer).toHaveFocus()
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const { user, composer } = await renderComposer()

    await user.type(composer, 'first{Shift>}{Enter}{/Shift}second')

    expect(composer).toHaveValue('first\nsecond')
  })

  it('does not send a blank message', async () => {
    const { user, composer } = await renderComposer()

    await user.type(composer, '   {Enter}')

    expect(composer).toHaveValue('   ')
  })

  it('caps messages at 2000 characters', async () => {
    const { user, composer } = await renderComposer()
    expect(composer).toHaveAttribute('maxLength', '2000')

    await user.click(composer)
    await user.paste('x'.repeat(2005))

    expect(composer).toHaveValue('x'.repeat(2000))
    expect(composer).toHaveAccessibleDescription(/2000 \/ 2000 characters$/)
  })

  it('offers a Send button that is disabled until there is something to send', async () => {
    const { user, composer } = await renderComposer()
    const send = screen.getByRole('button', { name: 'Send message' })
    expect(send).toHaveAttribute('type', 'submit')
    expect(send).toBeDisabled()

    await user.type(composer, '   ')
    expect(send).toBeDisabled()

    await user.type(composer, 'gg')
    expect(send).toBeEnabled()
  })

  it('sends with the Send button, clears, and puts focus back in the composer', async () => {
    const { user, composer } = await renderComposer()

    await user.type(composer, 'on my way')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(composer).toHaveValue('')
    expect(composer).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('does not send on Enter while an IME is composing', async () => {
    const { user, composer } = await renderComposer()
    await user.type(composer, 'konnichiwa')

    fireEvent.keyDown(composer, { key: 'Enter', keyCode: 229 })

    expect(composer).toHaveValue('konnichiwa')
  })

  it('shows "send" on the mobile keyboard Enter key', async () => {
    const { composer } = await renderComposer()

    expect(composer).toHaveAttribute('enterkeyhint', 'send')
  })

  it('has a labelled emoji button', async () => {
    await renderComposer()

    expect(screen.getByRole('button', { name: 'Add emoji' })).toBeInTheDocument()
  })

  it('labels the composer with the open channel', async () => {
    await renderRoute('/rooms/night-owls/clips')

    expect(screen.getByRole('textbox', { name: 'Message #clips' })).toBeInTheDocument()
  })
})
