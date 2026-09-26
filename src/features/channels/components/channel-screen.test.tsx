import { screen } from '@testing-library/react'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { renderRoute } from '@/test/render'

failOnConsoleError()

describe('TextChannelView', () => {
  it('shows "No messages yet" with the composer, and no sample messages', async () => {
    await renderRoute(roomPath(nightOwls, 'clips'))

    expect(screen.getByRole('heading', { level: 1, name: 'clips' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'No messages yet' })).toBeInTheDocument()
    expect(
      screen.getByText("Only members of Night Owls can see what's posted in #clips."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message #clips' })).toBeInTheDocument()
  })
})

describe('VoiceChannelView', () => {
  it('shows "No one\'s in voice" with Join voice, and no participants', async () => {
    await renderRoute(roomPath(nightOwls, 'late night'))

    expect(screen.getByRole('heading', { level: 1, name: 'late night' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: "No one's in voice" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Participants' })).not.toBeInTheDocument()
  })
})
