import { infiniteQueryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { meQueryOptions } from '@/features/auth'
import { useChannelErrorEffects } from '@/features/channels'
import { roomKeys, roomQueryOptions, type Role } from '@/features/rooms'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import { retryTransient } from '@/lib/api/retry'
import { forgetDeletedMessage, rememberDeletedMessage } from './deleted-message-ids'
import { getCachedMessage, messageKeys, removeMessage, sameMessageId, upsertMessage } from './message-cache'
import {
  bodyFieldMessage,
  MESSAGE_ERRORS,
  messageWriteErrorMessage,
} from './message-errors'
import {
  discardMessage,
  restoreToComposer,
  retryMessage,
  sendMessage,
  type SendContext,
} from './message-sender'
import { startEditing } from './pending-messages-store'
import type { Message, MessagePage } from './types'

/** Messages per history page. */
export const MESSAGES_PAGE_SIZE = 50

/**
 * A text channel's history: pages newest first (`fetchNextPage` loads older messages until
 * `hasNextPage` is false). 4xx errors aren't retried. Kept fresh for 30 s so hover preloads
 * reuse it; live updates go through the message-cache helpers.
 */
export function messagesQueryOptions(channelId: string) {
  return infiniteQueryOptions({
    queryKey: messageKeys.channel(channelId),
    queryFn: async ({ pageParam, signal }): Promise<MessagePage> => {
      const result = await withNetworkErrors(() =>
        api.GET('/api/channels/{channelId}/messages', {
          params: {
            path: { channelId },
            query: { limit: MESSAGES_PAGE_SIZE, ...(pageParam && { cursor: pageParam }) },
          },
          signal,
        }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
    retry: retryTransient,
  })
}

/**
 * Send messages to a channel: `send(body)` shows a pending row at once and POSTs with an
 * Idempotency-Key. Transient failures (offline, 429, 5xx) retry automatically with backoff
 * (only while online); a 404 takes the channels feature's channel/room-gone path.
 */
export function useSendMessage(roomId: string, channelId: string) {
  const queryClient = useQueryClient()
  const errorEffects = useChannelErrorEffects(roomId)
  const context = useMemo<SendContext>(
    () => ({ queryClient, onNotFound: errorEffects }),
    [errorEffects, queryClient],
  )

  return {
    send: useCallback((body: string) => sendMessage(context, channelId, body), [channelId, context]),
    retry: useCallback(
      (tempId: string) => retryMessage(context, channelId, tempId),
      [channelId, context],
    ),
    discard: useCallback((tempId: string) => discardMessage(channelId, tempId), [channelId]),
    restoreToComposer: useCallback(
      (tempId: string) => restoreToComposer(channelId, tempId),
      [channelId],
    ),
  }
}

interface EditVariables {
  message: Message
  body: string
}

/**
 * Edit your own message, optimistically: the new body shows at once (editedAt updates when the
 * server answers) and is rolled back on failure. A 404 forgets the message. Other failures
 * reopen the editor with the text (a 422 with its message inline; others with a toast).
 */
export function useEditMessage(roomId: string, channelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ message, body }: EditVariables): Promise<Message> => {
      const result = await withNetworkErrors(() =>
        api.PATCH('/api/messages/{messageId}', {
          params: { path: { messageId: message.id } },
          body: { body },
        }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    onMutate: ({ message, body }) => {
      upsertMessage(queryClient, channelId, { ...message, body })
    },
    onSuccess: (edited) => {
      upsertMessage(queryClient, channelId, edited)
    },
    onError: (error, { message, body }) => {
      // Roll back, unless a live update replaced the optimistic body meanwhile.
      const current = getCachedMessage(queryClient, channelId, message.id)
      if (current && current.body === body && current.editedAt === message.editedAt) {
        upsertMessage(queryClient, channelId, message)
      }
      if (error instanceof ApiError && error.status === 404) {
        removeMessage(queryClient, channelId, message.id)
        toast.error(MESSAGE_ERRORS.editGone)
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId), exact: true })
        toast.error(MESSAGE_ERRORS.editForbidden)
        return
      }
      const fieldMessage = bodyFieldMessage(error)
      startEditing(channelId, { messageId: message.id, text: body, error: fieldMessage })
      if (!fieldMessage) toast.error(messageWriteErrorMessage(error, MESSAGE_ERRORS.editFailed))
    },
  })
}

/**
 * Delete a message (yours, or any as an owner or admin), optimistically. 204 and 404 (already
 * gone) are done; other failures put it back and are left to the caller (the dialog).
 */
export function useDeleteMessage(roomId: string, channelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (message: Message): Promise<void> => {
      const result = await withNetworkErrors(() =>
        api.DELETE('/api/messages/{messageId}', { params: { path: { messageId: message.id } } }),
      )
      if (result.response.status === 204 || result.response.status === 404) return
      throw toApiError(result)
    },
    onMutate: (message) => {
      // So a backfill already in flight can't bring it back.
      rememberDeletedMessage(channelId, message.id)
      removeMessage(queryClient, channelId, message.id)
    },
    onError: (error, message) => {
      forgetDeletedMessage(channelId, message.id)
      upsertMessage(queryClient, channelId, message)
      if (error instanceof ApiError && error.status === 403) {
        // The role may have changed; refetching the room updates who can delete what.
        void queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId), exact: true })
      }
    },
  })
}

export interface MessagePermissions {
  viewerId: string | undefined
  canEdit: (message: Message) => boolean
  canDelete: (message: Message) => boolean
}

const MODERATOR_ROLES: ReadonlySet<Role> = new Set(['owner', 'admin'])

/** UI gates only (the API decides): edit your own; delete your own, or any as owner/admin. */
export function useMessagePermissions(roomId: string): MessagePermissions {
  const viewerId = useQuery(meQueryOptions).data?.id
  const myRole = useQuery(roomQueryOptions(roomId)).data?.myRole
  return useMemo(() => {
    const isOwn = (message: Message) =>
      viewerId !== undefined &&
      message.author !== null &&
      sameMessageId(message.author.id, viewerId)
    const moderator = myRole !== undefined && MODERATOR_ROLES.has(myRole)
    return {
      viewerId,
      canEdit: isOwn,
      canDelete: (message) => isOwn(message) || moderator,
    }
  }, [myRole, viewerId])
}
