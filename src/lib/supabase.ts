import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { getRealtimeAccessToken } from '@/lib/realtime/access-token'

/**
 * Read-only: fetching messages and Realtime subscriptions. Writes go through hideout-api.
 *
 * `realtime.accessToken` is required, not optional: supabase-js always gives Realtime a token
 * callback, which it re-runs on connect and every heartbeat (~25 s). The default one falls back
 * to the anon key when there's no Supabase Auth session (we sign in through Steam), which would
 * replace our hideout-api JWT within one heartbeat. This callback returns the token the Realtime
 * token manager holds; `supabase.realtime.setAuth(token)` pushes new ones immediately.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  realtime: {
    accessToken: async () => getRealtimeAccessToken(),
  },
})
