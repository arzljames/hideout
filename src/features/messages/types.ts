import type { InfiniteData } from '@tanstack/react-query'
import type { components } from '@/lib/api/schema.gen'

type Schemas = components['schemas']

// Aliases of the hideout-api contract types; never redeclare these shapes by hand.
export type Message = Schemas['Message']
export type MessagePage = Schemas['MessagePage']
export type SendMessageBody = Schemas['SendMessageBody']
export type EditMessageBody = Schemas['EditMessageBody']

/** A channel's cached history: pages newest first, each page's messages newest first. */
export type MessagesData = InfiniteData<MessagePage, string | undefined>
