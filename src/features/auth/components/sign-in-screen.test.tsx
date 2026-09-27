import { screen, within } from '@testing-library/react'
import { apiUrl } from '@/lib/api/client'
import { renderWithProviders } from '@/test/render'
import { SignInScreen } from './sign-in-screen'

describe('SignInScreen', () => {
  it('shows the brand heading, Steam sign-in button and privacy note', () => {
    renderWithProviders(<SignInScreen />)

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Hideout' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in with Steam' })).toBeInTheDocument()
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

  it('signs in with a plain same-tab link to the API', () => {
    renderWithProviders(<SignInScreen />)

    const link = screen.getByRole('link', { name: 'Sign in with Steam' })
    expect(link).toHaveAttribute('href', apiUrl('/api/auth/steam'))
    expect(link).not.toHaveAttribute('target')
  })

  it('offers a theme toggle', () => {
    renderWithProviders(<SignInScreen />)

    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })
})
