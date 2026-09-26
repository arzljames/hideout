import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { SignInScreen } from './sign-in-screen'

describe('SignInScreen', () => {
  it('shows the brand heading, Steam sign-in button and privacy note', () => {
    renderWithProviders(<SignInScreen />)

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Hideout' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeInTheDocument()
    expect(
      screen.getByText('Hideout only reads your public profile: name, avatar and current game.'),
    ).toBeInTheDocument()
  })

  it('shows "Powered by Steam" in the page footer landmark', () => {
    renderWithProviders(<SignInScreen />)

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByText('Powered by Steam')).toBeInTheDocument()
  })

  it('hides the decorative avatar initials from assistive technology', () => {
    renderWithProviders(<SignInScreen />)

    for (const initial of ['M', 'J', 'A']) {
      const node = screen.getByText(initial)
      expect(node.closest('[aria-hidden="true"]')).not.toBeNull()
      // Accessible queries ignore aria-hidden subtrees.
      expect(screen.queryByRole('img', { name: initial })).not.toBeInTheDocument()
    }
  })

  it('starts sign-in from a plain button and announces the popup wait', async () => {
    const user = userEvent.setup()
    const onSignIn = vi.fn()
    const { rerender } = renderWithProviders(<SignInScreen onSignIn={onSignIn} />)

    const button = screen.getByRole('button', { name: 'Sign in with Steam' })
    expect(button).toHaveAttribute('type', 'button')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    await user.click(button)
    expect(onSignIn).toHaveBeenCalledTimes(1)

    rerender(<SignInScreen onSignIn={onSignIn} waiting />)
    expect(screen.getByRole('status')).toHaveTextContent('Finish signing in in the Steam tab.')
    // Still enabled, so a closed popup can be reopened.
    expect(screen.getByRole('button', { name: 'Sign in with Steam' })).toBeEnabled()
  })

  it('offers a theme toggle', () => {
    renderWithProviders(<SignInScreen />)

    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })
})
