import { z } from 'zod'

// TODO(api): match the contract's message length limit.
export const MESSAGE_MAX_LENGTH = 2000

export const composerSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Type a message first")
    .max(MESSAGE_MAX_LENGTH, `At most ${MESSAGE_MAX_LENGTH} characters`),
})

export type ComposerValues = z.infer<typeof composerSchema>

export const composerDefaults: ComposerValues = { content: '' }
