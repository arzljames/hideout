import { resetPendingInvitesStore, usePendingInvitesStore } from './pending-invites-store'
import { samplePendingInvites } from './sample-pending-invites'

// setup.ts resets the store after each test.
const state = () => usePendingInvitesStore.getState()
const ids = () => state().invites.map((invite) => invite.id)

describe('pending invites store', () => {
  it('starts with the three sample invites in order', () => {
    expect(ids()).toEqual(['inv-raid', 'inv-coop', 'inv-speedrun'])
  })

  it('accept removes only that invite', () => {
    state().accept('inv-coop')

    expect(ids()).toEqual(['inv-raid', 'inv-speedrun'])
  })

  it('decline removes only that invite', () => {
    state().decline('inv-raid')

    expect(ids()).toEqual(['inv-coop', 'inv-speedrun'])
  })

  it('ignores an unknown id', () => {
    const before = state().invites
    state().accept('nope')
    state().decline('nope')

    expect(ids()).toEqual(['inv-raid', 'inv-coop', 'inv-speedrun'])
    expect(state().invites).toEqual(before)
  })

  it('can empty the list', () => {
    state().accept('inv-raid')
    state().decline('inv-coop')
    state().accept('inv-speedrun')

    expect(state().invites).toEqual([])
  })

  it('does not mutate the sample data', () => {
    state().accept('inv-raid')

    expect(samplePendingInvites).toHaveLength(3)
  })

  it('reset restores the sample invites', () => {
    state().accept('inv-raid')
    state().decline('inv-coop')

    resetPendingInvitesStore()

    expect(ids()).toEqual(['inv-raid', 'inv-coop', 'inv-speedrun'])
  })
})
