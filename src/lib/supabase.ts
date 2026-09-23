import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/** Read-only: fetching messages and Realtime subscriptions. Writes go through hideout-api. */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
