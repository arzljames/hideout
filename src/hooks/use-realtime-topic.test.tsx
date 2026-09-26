import { meFixture } from '@/test/fixtures/me'
import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { getRealtimeStatus, startRealtime } from '@/lib/realtime/connection'
import { fakeSupabase } from '@/test/fake-supabase'
import { useRealtimeTopic } from './use-realtime-topic'

async function ready() {
  startRealtime(meFixture.id)
  await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
}

describe('useRealtimeTopic', () => {
  it('waits for a token before joining', async () => {
    const { rerender } = renderHook(() => useRealtimeTopic('room:a', { onBroadcast: () => {} }))
    expect(fakeSupabase.channel).not.toHaveBeenCalled()

    await act(ready)
    rerender()

    expect(fakeSupabase.channelsFor('room:a')).toHaveLength(1)
  })

  it('removes the channel on unmount, once, under StrictMode', async () => {
    await ready()
    const { unmount } = renderHook(() => useRealtimeTopic('room:a', { onBroadcast: () => {} }), {
      wrapper: StrictMode,
    })
    expect(fakeSupabase.created).toHaveLength(1)
    const channel = fakeSupabase.channelsFor('room:a')[0]!

    unmount()
    await vi.waitFor(() => expect(channel.removed).toBe(true))
    expect(fakeSupabase.removeChannel).toHaveBeenCalledTimes(1)
  })

  it('always calls the latest listener without resubscribing', async () => {
    await ready()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ onBroadcast }) => useRealtimeTopic('room:a', { onBroadcast }),
      { initialProps: { onBroadcast: first } },
    )
    rerender({ onBroadcast: second })

    fakeSupabase.channelsFor('room:a')[0]!.emitBroadcast('room:updated', { x: 1 })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('room:updated', { x: 1 })
    expect(fakeSupabase.created).toHaveLength(1)
  })

  it('switches topics and leaves the old one; null leaves', async () => {
    await ready()
    const { rerender } = renderHook(
      ({ topic }: { topic: string | null }) => useRealtimeTopic(topic, { onBroadcast: () => {} }),
      { initialProps: { topic: 'room:a' as string | null } },
    )

    rerender({ topic: 'room:b' })
    await vi.waitFor(() => expect(fakeSupabase.channelsFor('room:a')).toHaveLength(0))
    expect(fakeSupabase.channelsFor('room:b')).toHaveLength(1)

    rerender({ topic: null })
    await vi.waitFor(() => expect(fakeSupabase.channels).toHaveLength(0))
  })
})
