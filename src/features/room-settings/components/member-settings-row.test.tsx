import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'

failOnConsoleError()

/**
 * Render a member row with the process in `timeZone`. The row's Intl.DateTimeFormat is created
 * at module load, so the module (and RTL/React with it) is re-imported after switching TZ.
 */
async function joinedTextIn(timeZone: string, joinedAt: string) {
  // stubEnv writes process.env.TZ, which Node applies to Date and Intl immediately.
  vi.stubEnv('TZ', timeZone)
  vi.resetModules()
  try {
    const { render, screen } = await import('@testing-library/react')
    const { MemberSettingsRow } = await import('./member-settings-row')
    const { unmount } = render(
      <ul>
        <MemberSettingsRow
          member={{ id: 'theo', name: 'Theo', presence: 'online', joinedAt }}
          roomName="Night Owls"
          viewerRole="member"
        />
      </ul>,
    )
    const text = screen.getByText(/^Joined/).textContent
    // This RTL instance isn't the one setup.ts cleans up, so unmount here.
    unmount()
    return text
  } finally {
    vi.unstubAllEnvs()
    vi.resetModules()
  }
}

describe('MemberSettingsRow join date', () => {
  it('shows the join month in a timezone east of UTC', async () => {
    expect(await joinedTextIn('Asia/Manila', '2026-09-01')).toBe('Joined Sep 2026')
  })

  // joinedAt is a date-only string; the month must not slip back a day in timezones west of UTC.
  it('shows the join month in a timezone west of UTC', async () => {
    expect(await joinedTextIn('America/Los_Angeles', '2026-09-01')).toBe('Joined Sep 2026')
  })
})
