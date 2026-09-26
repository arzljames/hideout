import { z } from 'zod'

const envSchema = z.object({
  // Optional: unset (or empty) means same-origin requests, e.g. through the Vite dev proxy.
  VITE_API_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .url()
      .optional()
      .transform((url) => url?.replace(/\/+$/, ''))
      // Session cookies must never travel over plain http in production.
      .refine((url) => !import.meta.env.PROD || url === undefined || url.startsWith('https://'), {
        message: 'VITE_API_URL must use https in production',
      }),
  ),
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
