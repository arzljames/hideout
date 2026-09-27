import { useEffect } from 'react'

/*
 * The invite URL carries a bearer token. While it's in the address bar, send no Referer at all,
 * so nothing loaded from the page (avatars, the Steam sign-in hop) ever sees it.
 */

const META_ID = 'hideout-no-referrer'

/** Add `<meta name="referrer" content="no-referrer">` if it isn't there. Returns its remover. */
export function ensureNoReferrerMeta(): () => void {
  let meta = document.getElementById(META_ID)
  if (!meta) {
    meta = document.createElement('meta')
    meta.id = META_ID
    meta.setAttribute('name', 'referrer')
    meta.setAttribute('content', 'no-referrer')
    document.head.appendChild(meta)
  }
  return () => document.getElementById(META_ID)?.remove()
}

/** Keep the no-referrer policy while the calling component is mounted. */
export function useNoReferrer(): void {
  useEffect(() => ensureNoReferrerMeta(), [])
}
