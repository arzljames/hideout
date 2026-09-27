import { create } from 'zustand'

export interface PendingMessageError {
  code: string
  message: string
  /** A 422's `body.body` detail, when the API rejected the text itself. */
  fieldMessage?: string
}

/** A message this tab is sending (or failed to send), shown after the channel's history. */
export interface PendingMessage {
  tempId: string
  channelId: string
  /** Sent with every attempt of this message, so a retry never posts it twice. */
  idempotencyKey: string
  body: string
  status: 'sending' | 'failed'
  error?: PendingMessageError
  /** POSTs made for this message since it was sent (or last retried by hand). */
  attempts: number
  /** Failed with a transient error: it's retried automatically (at `nextRetryAt`, or once back online). */
  autoRetry: boolean
  /**
   * A live message (or backfill) from us with the same body arrived while sending: probably its
   * echo, so the row is hidden. Removed when the POST succeeds; shown again if it fails.
   */
  echoed?: boolean
  /** When the next automatic retry is due (epoch ms); unset while offline or not retrying. */
  nextRetryAt?: number
  /** Epoch ms. */
  createdAt: number
}

/** The inline editor's state for a channel: which message, and text/error to reopen it with. */
export interface EditingState {
  messageId: string
  /** Reopen with this text (after a failed save) instead of the message body. */
  text?: string
  /** A 422 message to show in the editor. */
  error?: string
}

interface PendingMessagesState {
  /** Per channel (lowercase id), oldest first. */
  pending: Record<string, PendingMessage[]>
  /** Composer drafts per channel (lowercase id), kept while the tab is open. */
  drafts: Record<string, string>
  /** Bumped when a draft is replaced from outside the composer (restoreToComposer). */
  draftRevisions: Record<string, number>
  /** The open inline editor per channel. */
  editing: Record<string, EditingState | undefined>
}

const initialState: PendingMessagesState = {
  pending: {},
  drafts: {},
  draftRevisions: {},
  editing: {},
}

export const usePendingMessagesStore = create<PendingMessagesState>()(() => initialState)

const channelKey = (channelId: string) => channelId.toLowerCase()

const EMPTY: readonly PendingMessage[] = []

/** The channel's pending messages, oldest first. */
export function usePendingMessages(channelId: string): readonly PendingMessage[] {
  return usePendingMessagesStore((state) => state.pending[channelKey(channelId)] ?? EMPTY)
}

export function getPendingMessages(channelId: string): readonly PendingMessage[] {
  return usePendingMessagesStore.getState().pending[channelKey(channelId)] ?? EMPTY
}

export function findPendingMessage(channelId: string, tempId: string): PendingMessage | undefined {
  return getPendingMessages(channelId).find((item) => item.tempId === tempId)
}

/** Every pending message, in every channel. */
export function allPendingMessages(): PendingMessage[] {
  return Object.values(usePendingMessagesStore.getState().pending).flat()
}

export function addPendingMessage(item: PendingMessage) {
  const key = channelKey(item.channelId)
  usePendingMessagesStore.setState((state) => ({
    pending: { ...state.pending, [key]: [...(state.pending[key] ?? []), item] },
  }))
}

export function updatePendingMessage(
  channelId: string,
  tempId: string,
  patch: Partial<Omit<PendingMessage, 'tempId' | 'channelId'>>,
) {
  const key = channelKey(channelId)
  usePendingMessagesStore.setState((state) => {
    const items = state.pending[key]
    if (!items?.some((item) => item.tempId === tempId)) return state
    return {
      pending: {
        ...state.pending,
        [key]: items.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)),
      },
    }
  })
}

export function removePendingMessage(channelId: string, tempId: string) {
  const key = channelKey(channelId)
  usePendingMessagesStore.setState((state) => {
    const items = state.pending[key]
    if (!items?.some((item) => item.tempId === tempId)) return state
    return { pending: { ...state.pending, [key]: items.filter((item) => item.tempId !== tempId) } }
  })
}

// --- Drafts ----------------------------------------------------------------------------------

export function getDraft(channelId: string): string {
  return usePendingMessagesStore.getState().drafts[channelKey(channelId)] ?? ''
}

export function setDraft(channelId: string, text: string) {
  const key = channelKey(channelId)
  if (getDraft(channelId) === text) return
  usePendingMessagesStore.setState((state) => ({ drafts: { ...state.drafts, [key]: text } }))
}

/** Replace the draft from outside the composer; a mounted composer picks it up and focuses. */
export function replaceDraft(channelId: string, text: string) {
  const key = channelKey(channelId)
  usePendingMessagesStore.setState((state) => ({
    drafts: { ...state.drafts, [key]: text },
    draftRevisions: { ...state.draftRevisions, [key]: (state.draftRevisions[key] ?? 0) + 1 },
  }))
}

export function useDraftRevision(channelId: string): number {
  return usePendingMessagesStore((state) => state.draftRevisions[channelKey(channelId)] ?? 0)
}

// --- Editing ---------------------------------------------------------------------------------

export function useEditingState(channelId: string): EditingState | undefined {
  return usePendingMessagesStore((state) => state.editing[channelKey(channelId)])
}

export function startEditing(channelId: string, editing: EditingState) {
  const key = channelKey(channelId)
  usePendingMessagesStore.setState((state) => ({ editing: { ...state.editing, [key]: editing } }))
}

/** Close the editor; with `messageId`, only if it's still that message's editor. */
export function stopEditing(channelId: string, messageId?: string) {
  const key = channelKey(channelId)
  usePendingMessagesStore.setState((state) => {
    const current = state.editing[key]
    if (!current) return state
    if (messageId && current.messageId.toLowerCase() !== messageId.toLowerCase()) return state
    return { editing: { ...state.editing, [key]: undefined } }
  })
}

/** Restore the initial state (for tests). Pending sends' timers are cleared by the sender. */
export function resetPendingMessagesStore() {
  usePendingMessagesStore.setState(initialState, true)
}
