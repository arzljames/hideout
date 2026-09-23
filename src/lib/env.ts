import { z } from 'zod'

const envSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_LIVEKIT_URL: z.url(),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${z.prettifyError(parsed.error)}\nCopy .env.example to .env.local and fill it in.`,
  )
}

export const env = parsed.data
