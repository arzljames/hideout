import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinForm } from './join-form'

describe('JoinForm', () => {
  it('shows a validation error for a too-short name', async () => {
    const user = userEvent.setup()
    render(<JoinForm />)

    await user.type(screen.getByLabelText('Display name'), 'a')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('At least 2 characters')).toBeInTheDocument()
  })
})
