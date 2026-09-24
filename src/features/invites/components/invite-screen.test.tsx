import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { InviteScreen } from './invite-screen'

describe('InviteScreen', () => {
  it('renders a banner and a main landmark containing the invite card', () => {
    renderWithProviders(<InviteScreen />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'Night Owls' })).toBeInTheDocument()
    expect(within(main).getByRole('button', { name: 'Join room' })).toBeInTheDocument()
  })

  it('has exactly one level-1 heading on the page', () => {
    renderWithProviders(<InviteScreen />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
