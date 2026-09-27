import type { QueryClient } from '@tanstack/react-query'
import { meQueryOptions } from '@/features/auth'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import { upsertMessage } from './message-cache'
import { bodyFieldMessage, isTransientError, MESSAGE_ERRORS } from './message-errors'
import { normalizeNewlines } from './message-body-schema'
import {
  addPendingMessage,
  allPendingMessages,
  findPendingMessage,
  getDraft,
  getPendingMessages,
  removePendingMessage,
  replaceDraft,
  updatePendingMessage,
  type PendingMessageError,
} from './pending-messages-store'
import type { Message } from './types'

// Sends outlive the component that started them (a route change mid-send still lands the
// message), so their timers and callbacks live here, per temp id, not in React state.

/** Delays before each automatic retry of a transient failure (at most this many retries). */
export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000] as const

export interface SendContext {
  queryClient: QueryClient
  /** A 404 (channel or room gone): the channels feature's error effects. */
  onNotFound: (error: ApiError) => void | Promise<unknown>
}

const contexts = new Map<string, SendContext>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const inFlight = new Set<string>()
/** Temp ids that already swapped to a fresh key after IDEMPOTENCY_KEY_REUSED. */
const renewedKeys = new Set<string>()

function newKey(): string {
  return crypto.randomUUID()
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function clearTimer(tempId: string) {
  const timer = timers.get(tempId)
  if (timer !== undefined) clearTimeout(timer)
  timers.delete(tempId)
}

function forget(tempId: string) {
  clearTimer(tempId)
  contexts.delete(tempId)
  renewedKeys.delete(tempId)
}

function errorOf(error: unknown): PendingMessageError {
  if (!(error instanceof ApiError)) return { code: 'UNKNOWN', message: MESSAGE_ERRORS.sendFailed }
  if (error.code === 'NETWORK') return { code: error.code, message: MESSAGE_ERRORS.offline }
  switch (error.status) {
    case 403:
      return { code: error.code, message: MESSAGE_ERRORS.forbidden }
    case 404:
      return { code: error.code, message: MESSAGE_ERRORS.channelGone }
    case 409:
      return {
        code: error.code,
        message: error.code === 'CHANNEL_NOT_TEXT' ? MESSAGE_ERRORS.notText : MESSAGE_ERRORS.sendFailed,
      }
    case 422: {
      const fieldMessage = bodyFieldMessage(error)
      return { code: error.code, message: fieldMessage ?? MESSAGE_ERRORS.sendFailed, fieldMessage }
    }
    case 429:
      return { code: error.code, message: MESSAGE_ERRORS.rateLimited }
    default:
      return { code: error.code, message: error.status >= 500 ? MESSAGE_ERRORS.server : MESSAGE_ERRORS.sendFailed }
  }
}

async function post(channelId: string, body: string, idempotencyKey: string): Promise<Message> {
  const result = await withNetworkErrors(() =>
    api.POST('/api/channels/{channelId}/messages', {
      params: { path: { channelId }, header: { 'Idempotency-Key': idempotencyKey } },
      body: { body },
    }),
  )
  // 201 (sent) and 200 (an idempotent replay of this message) are both success.
  if (result.data) return result.data
  throw toApiError(result)
}

function scheduleRetry(channelId: string, tempId: string, attempts: number) {
  clearTimer(tempId)
  const retryNumber = attempts - 1 // attempts includes the first POST
  const delay = RETRY_DELAYS_MS[retryNumber]
  if (delay === undefined) {
    updatePendingMessage(channelId, tempId, { autoRetry: false, nextRetryAt: undefined })
    return
  }
  if (!isOnline()) {
    // Resumed by the `online` listener below.
    updatePendingMessage(channelId, tempId, { autoRetry: true, nextRetryAt: undefined })
    return
  }
  updatePendingMessage(channelId, tempId, { autoRetry: true, nextRetryAt: Date.now() + delay })
  timers.set(
    tempId,
    setTimeout(() => {
      timers.delete(tempId)
      if (!isOnline()) {
        updatePendingMessage(channelId, tempId, { nextRetryAt: undefined })
        return
      }
      void attempt(channelId, tempId)
    }, delay),
  )
}

async function attempt(channelId: string, tempId: string): Promise<void> {
  const item = findPendingMessage(channelId, tempId)
  const context = contexts.get(tempId)
  if (!item || !context || inFlight.has(tempId)) return
  clearTimer(tempId)
  inFlight.add(tempId)
  const attempts = item.attempts + 1
  updatePendingMessage(channelId, tempId, {
    status: 'sending',
    error: undefined,
    attempts,
    nextRetryAt: undefined,
  })

  try {
    const message = await post(channelId, item.body, item.idempotencyKey)
    // Discarded meanwhile: it was still posted, so it shows like any other message.
    upsertMessage(context.queryClient, channelId, message)
    removePendingMessage(channelId, tempId)
    forget(tempId)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (!findPendingMessage(channelId, tempId)) {
      forget(tempId)
      return
    }
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === 'IDEMPOTENCY_KEY_REUSED' &&
      !renewedKeys.has(tempId)
    ) {
      // The key belongs to another message now (or this one was deleted/edited): once, with a new key.
      renewedKeys.add(tempId)
      updatePendingMessage(channelId, tempId, { idempotencyKey: newKey() })
      inFlight.delete(tempId)
      await attempt(channelId, tempId)
      return
    }
    const failure = errorOf(error)
    // Un-hide an echoed row: the echo was another tab's message, and this one wasn't sent.
    updatePendingMessage(channelId, tempId, {
      status: 'failed',
      error: failure,
      autoRetry: false,
      echoed: false,
    })
    if (isTransientError(error)) {
      scheduleRetry(channelId, tempId, attempts)
    } else if (error instanceof ApiError && error.status === 404) {
      void context.onNotFound(error)
    }
  } finally {
    inFlight.delete(tempId)
  }
}

/** Start sending `body` (as typed). Returns the pending message's temp id. */
export function sendMessage(context: SendContext, channelId: string, body: string): string {
  const tempId = `temp-${crypto.randomUUID()}`
  contexts.set(tempId, context)
  addPendingMessage({
    tempId,
    channelId,
    idempotencyKey: newKey(),
    body,
    status: 'sending',
    attempts: 0,
    autoRetry: false,
    createdAt: Date.now(),
  })
  void attempt(channelId, tempId)
  return tempId
}

/** Retry a failed message now, with the same key (restarts the automatic retry count). */
export function retryMessage(context: SendContext, channelId: string, tempId: string) {
  const item = findPendingMessage(channelId, tempId)
  if (!item || item.status !== 'failed') return
  contexts.set(tempId, context)
  updatePendingMessage(channelId, tempId, { attempts: 0 })
  void attempt(channelId, tempId)
}

/** Drop a pending message (a POST in flight may still land; it then shows as sent). */
export function discardMessage(channelId: string, tempId: string) {
  removePendingMessage(channelId, tempId)
  forget(tempId)
}

/**
 * Put a failed message's text back in the composer (after what's there, on a new line), and
 * drop it from the pending list.
 */
export function restoreToComposer(channelId: string, tempId: string) {
  const item = findPendingMessage(channelId, tempId)
  if (!item) return
  const draft = getDraft(channelId)
  replaceDraft(channelId, draft ? `${draft}\n${item.body}` : item.body)
  discardMessage(channelId, tempId)
}

/**
 * For the realtime `message:created` handler and backfill: when a live message is this user's
 * own and a message with the same body is still sending, hide that pending row (the live
 * message stands in for it). The row is removed only when its POST succeeds (the result is
 * deduplicated by id); if the POST fails (the echo was really another tab's message), it shows
 * again as failed, with Retry. Returns true if a pending row was hidden.
 */
export function dropPendingEcho(
  queryClient: QueryClient,
  channelId: string,
  message: Message,
): boolean {
  const me = queryClient.getQueryData(meQueryOptions.queryKey)
  const authorId = message.author?.id
  if (!me || !authorId || authorId.toLowerCase() !== me.id.toLowerCase()) return false
  const body = normalizeNewlines(message.body)
  const match = getPendingMessages(channelId).find(
    (item) => item.status === 'sending' && !item.echoed && normalizeNewlines(item.body) === body,
  )
  if (!match) return false
  updatePendingMessage(channelId, match.tempId, { echoed: true })
  return true
}

function resumeWaitingSends() {
  for (const item of allPendingMessages()) {
    if (item.status === 'failed' && item.autoRetry && !timers.has(item.tempId)) {
      void attempt(item.channelId, item.tempId)
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', resumeWaitingSends)
}

/** Stop every timer and forget every send (for tests). */
export function resetMessageSender() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  contexts.clear()
  inFlight.clear()
  renewedKeys.clear()
}
