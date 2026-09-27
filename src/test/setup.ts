import '@testing-library/jest-dom/vitest'
import './polyfills'
import { cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { resetMessageSender } from '@/features/messages/message-sender'
import { resetPendingMessagesStore } from '@/features/messages/pending-messages-store'
import { resetMemberPanelStore } from '@/features/rooms/member-panel-store'
import { resetVoiceStore } from '@/features/voice/voice-session'
import { setUnauthenticatedHandler } from '@/lib/api/client'
import { setRealtimeSignedOutHandler, stopRealtime } from '@/lib/realtime/connection'
import { fakeLiveKit } from './fake-livekit'
import { fakeSupabase } from './fake-supabase'
import { server } from './msw/server'

// No test talks to Supabase: Realtime runs against a fake client (see fake-supabase.ts).
vi.mock('@/lib/supabase', async () => {
  const { fakeSupabase } = await import('./fake-supabase')
  return { supabase: fakeSupabase }
})

function resetThemeState() {
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
}

// No test talks to LiveKit either: the real enums with a fake Room and mic (see fake-livekit.ts).
vi.mock('livekit-client', async (importActual) => {
  const { fakeLiveKitModule } = await import('./fake-livekit')
  return fakeLiveKitModule(await importActual<typeof import('livekit-client')>())
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetThemeState())
afterEach(() => {
  server.resetHandlers()
  cleanup()
  // Zustand stores are module singletons; start every test from their initial state.
  resetVoiceStore()
  fakeLiveKit.reset()
  vi.unstubAllGlobals()
  resetMemberPanelStore()
  // renderRoute registers a handler bound to that test's router and QueryClient.
  setUnauthenticatedHandler(undefined)
  setRealtimeSignedOutHandler(undefined)
  window.sessionStorage.clear()
  resetMessageSender()
  resetPendingMessagesStore()
  // Realtime is a module singleton too (token manager, topics, the fake client's channels).
  stopRealtime()
  fakeSupabase.reset()
  // sonner's toast state is a module singleton and replays still-active toasts to a newly
  // mounted <Toaster />, so a toast from one test would otherwise show up in the next.
  toast.dismiss()
})
afterAll(() => server.close())
