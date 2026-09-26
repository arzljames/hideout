import { SETTINGS_SECTIONS, settingsSearchSchema } from './settings-sections'

describe('settingsSearchSchema', () => {
  it('defaults to overview when section is missing', () => {
    expect(settingsSearchSchema.parse({})).toEqual({ section: 'overview' })
  })

  it.each(['overview', 'members', 'invites', 'channels'])('accepts %s', (section) => {
    expect(settingsSearchSchema.parse({ section })).toEqual({ section })
  })

  it.each(['nope', '', 'Members', 42, null])('falls back to overview for %j', (section) => {
    expect(settingsSearchSchema.parse({ section })).toEqual({ section: 'overview' })
  })
})

describe('SETTINGS_SECTIONS', () => {
  it('lists the sections in nav order', () => {
    expect(SETTINGS_SECTIONS.map((section) => section.label)).toEqual([
      'Overview',
      'Members',
      'Invites',
      'Channels',
    ])
  })
})
