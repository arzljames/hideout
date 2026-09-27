// Ids deleted while a channel is open (live `message:deleted`, or this tab's own optimistic
// delete), per live channel session, so a backfill already in flight can't bring them back.
// Sessions are registered by useChannelMessages for as long as the channel is open.

/** Most ids remembered per session. */
const DELETED_IDS_MAX = 200

const sessions = new Map<string, Set<Set<string>>>()

const channelKey = (channelId: string) => channelId.toLowerCase()

function add(ids: Set<string>, messageId: string) {
  ids.add(messageId.toLowerCase())
  if (ids.size > DELETED_IDS_MAX) {
    const oldest = ids.values().next()
    if (!oldest.done) ids.delete(oldest.value)
  }
}

/** Register a session's deleted-id set for a channel. Returns the unregister function. */
export function registerDeletedIds(channelId: string, ids: Set<string>): () => void {
  const key = channelKey(channelId)
  let set = sessions.get(key)
  if (!set) {
    set = new Set()
    sessions.set(key, set)
  }
  set.add(ids)
  return () => {
    const current = sessions.get(key)
    current?.delete(ids)
    if (current?.size === 0) sessions.delete(key)
  }
}

/** Remember a deleted message in one session's set. */
export function addDeletedId(ids: Set<string>, messageId: string) {
  add(ids, messageId)
}

/** Remember a deleted message in every open session of its channel (no-op when none is open). */
export function rememberDeletedMessage(channelId: string, messageId: string) {
  for (const ids of sessions.get(channelKey(channelId)) ?? []) add(ids, messageId)
}

/** Forget a remembered id (e.g. an optimistic delete that failed and was rolled back). */
export function forgetDeletedMessage(channelId: string, messageId: string) {
  for (const ids of sessions.get(channelKey(channelId)) ?? []) ids.delete(messageId.toLowerCase())
}
