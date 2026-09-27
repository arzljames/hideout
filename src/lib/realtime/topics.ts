import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getRealtimeStatus, refreshRealtimeToken, subscribeRealtimeStatus } from './connection'
import { backoffDelay } from './token-manager'

/** A topic that hasn't reached SUBSCRIBED for this long is reported `stuck`. */
export const STUCK_AFTER_MS = 30_000
/** ...then re-reported with a doubling interval, capped here, until it subscribes. */
export const STUCK_RECHECK_CAP_MS = 60_000
/** ...or reported as soon as this many join attempts in a row have failed. */
export const STUCK_AFTER_FAILURES = 5

export type TopicStatus =
  /**
   * Joined. `afterError`: rejoined after a failure, so broadcasts may have been missed.
   * `downForMs`: with `afterError`, how long since the topic last left SUBSCRIBED (or, if it
   * never joined, since it started joining); 0 otherwise.
   */
  | { type: 'subscribed'; afterError: boolean; downForMs: number }
  /** Not joined for a while (see STUCK_*). supabase-js keeps retrying. */
  | { type: 'stuck' }

export interface TopicListener {
  /** A broadcast on the topic. The payload is untrusted: parse it. */
  onBroadcast: (event: string, payload: unknown) => void
  onStatus?: (status: TopicStatus) => void
}

interface Entry {
  topic: string
  listeners: Set<TopicListener>
  channel: RealtimeChannel | null
  subscribed: boolean
  hadError: boolean
  /** When the topic last left SUBSCRIBED (or started joining); undefined while subscribed. */
  downSince: number | undefined
  failures: number
  stuckTimer: ReturnType<typeof setTimeout> | undefined
  stuckDelay: number
  recreateTimer: ReturnType<typeof setTimeout> | undefined
  recreateAttempts: number
  releasing: boolean
}

const entries = new Map<string, Entry>()
/** Channels still leaving, by topic: supabase-js returns an existing channel for a topic. */
const removals = new Map<string, Promise<void>>()
let watchingStatus = false

function trackRemoval(topic: string, removal: Promise<unknown>) {
  const previous = removals.get(topic)
  const done: Promise<void> = Promise.all([previous, removal.catch(() => {})]).then(() => {
    if (removals.get(topic) === done) removals.delete(topic)
  })
  removals.set(topic, done)
}

function isActive(entry: Entry) {
  return entries.get(entry.topic) === entry
}

function emit(entry: Entry, status: TopicStatus) {
  for (const listener of [...entry.listeners]) listener.onStatus?.(status)
}

function armStuck(entry: Entry) {
  if (entry.stuckTimer !== undefined || entry.subscribed) return
  entry.stuckTimer = setTimeout(() => fireStuck(entry), entry.stuckDelay)
}

function fireStuck(entry: Entry) {
  clearTimeout(entry.stuckTimer)
  entry.stuckTimer = undefined
  if (!isActive(entry) || entry.subscribed) return
  // A long gap, even on a first join: treat the eventual SUBSCRIBED as a rejoin (refetch).
  entry.hadError = true
  entry.stuckDelay = Math.min(entry.stuckDelay * 2, STUCK_RECHECK_CAP_MS)
  armStuck(entry)
  emit(entry, { type: 'stuck' })
}

function recordFailure(entry: Entry) {
  entry.subscribed = false
  entry.downSince ??= Date.now()
  entry.hadError = true
  entry.failures += 1
  if (entry.failures === STUCK_AFTER_FAILURES) fireStuck(entry)
  else armStuck(entry)
}

function isTokenError(error: Error | undefined) {
  return /jwt|token|expired/i.test(error?.message ?? '')
}

function onChannelStatus(entry: Entry, channel: RealtimeChannel, status: string, error?: Error) {
  switch (status) {
    case 'SUBSCRIBED': {
      const afterError = entry.hadError
      const downForMs = afterError ? Math.max(0, Date.now() - (entry.downSince ?? Date.now())) : 0
      entry.subscribed = true
      entry.hadError = false
      entry.downSince = undefined
      entry.failures = 0
      entry.recreateAttempts = 0
      entry.stuckDelay = STUCK_AFTER_MS
      clearTimeout(entry.stuckTimer)
      entry.stuckTimer = undefined
      emit(entry, { type: 'subscribed', afterError, downForMs })
      return
    }
    case 'CHANNEL_ERROR':
    case 'TIMED_OUT':
      // supabase-js rejoins this channel itself (its rejoin timer); don't create another one.
      recordFailure(entry)
      if (isTokenError(error)) refreshRealtimeToken()
      return
    case 'CLOSED': {
      // Closed by the server (e.g. the token expired): supabase-js won't rejoin this channel,
      // so replace it after a backoff, with a fresh token if the old one was the problem.
      entry.channel = null
      trackRemoval(entry.topic, supabase.removeChannel(channel))
      recordFailure(entry)
      refreshRealtimeToken()
      entry.recreateAttempts += 1
      clearTimeout(entry.recreateTimer)
      entry.recreateTimer = setTimeout(() => {
        entry.recreateTimer = undefined
        openChannel(entry)
      }, backoffDelay(entry.recreateAttempts))
      return
    }
  }
}

function openChannel(entry: Entry, retried = false) {
  if (!isActive(entry) || entry.channel || getRealtimeStatus() !== 'ready') return
  const pending = removals.get(entry.topic)
  if (pending) {
    void pending.then(() => openChannel(entry, retried))
    return
  }
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${entry.topic}`)
  if (stale && !retried) {
    trackRemoval(entry.topic, supabase.removeChannel(stale))
    openChannel(entry, true)
    return
  }

  const channel = supabase.channel(entry.topic, { config: { private: true } })
  entry.channel = channel
  channel.on('broadcast', { event: '*' }, (message) => {
    if (entry.channel !== channel || !isActive(entry)) return
    const event: unknown = message.event
    if (typeof event !== 'string') return
    const payload: unknown = message.payload
    for (const listener of [...entry.listeners]) listener.onBroadcast(event, payload)
  })
  channel.subscribe((status, error) => {
    if (entry.channel !== channel || !isActive(entry)) return
    onChannelStatus(entry, channel, status, error)
  })
  armStuck(entry)
}

function clearEntryTimers(entry: Entry) {
  clearTimeout(entry.stuckTimer)
  clearTimeout(entry.recreateTimer)
  entry.stuckTimer = undefined
  entry.recreateTimer = undefined
}

function release(entry: Entry) {
  entries.delete(entry.topic)
  clearEntryTimers(entry)
  const channel = entry.channel
  entry.channel = null
  if (channel) trackRemoval(entry.topic, supabase.removeChannel(channel))
}

/**
 * Forget every topic without touching channels: used when Realtime stops, which removes all
 * channels itself. Callbacks from those channels are ignored afterwards.
 */
export function resetTopics(): void {
  for (const entry of entries.values()) {
    clearEntryTimers(entry)
    entry.channel = null
  }
  entries.clear()
  removals.clear()
}

function watchRealtimeStatus() {
  if (watchingStatus) return
  watchingStatus = true
  subscribeRealtimeStatus(() => {
    const status = getRealtimeStatus()
    if (status === 'idle') resetTopics()
    // Topics subscribed before the first token join now.
    if (status === 'ready') for (const entry of entries.values()) openChannel(entry)
  })
}

/**
 * Listen on a private Broadcast topic (e.g. `room:<id>`). One channel per topic however many
 * listeners, joined with `config: { private: true }` once Realtime is `ready`. The returned
 * function removes the listener; the last one out removes the channel, deferred a microtask so
 * an unmount and remount in the same commit (StrictMode, route changes) reuse it.
 */
export function subscribeTopic(topic: string, listener: TopicListener): () => void {
  watchRealtimeStatus()
  let entry = entries.get(topic)
  if (!entry) {
    entry = {
      topic,
      listeners: new Set(),
      channel: null,
      subscribed: false,
      hadError: false,
      downSince: Date.now(),
      failures: 0,
      stuckTimer: undefined,
      stuckDelay: STUCK_AFTER_MS,
      recreateTimer: undefined,
      recreateAttempts: 0,
      releasing: false,
    }
    entries.set(topic, entry)
    openChannel(entry)
  }
  entry.releasing = false
  entry.listeners.add(listener)
  if (entry.subscribed) listener.onStatus?.({ type: 'subscribed', afterError: false, downForMs: 0 })

  const owned = entry
  return () => {
    if (!owned.listeners.delete(listener) || owned.listeners.size > 0) return
    owned.releasing = true
    queueMicrotask(() => {
      if (owned.releasing && isActive(owned)) release(owned)
    })
  }
}
