import type { ReactNode } from 'react'

// Candidate URLs: http(s) up to the next whitespace. Validated with URL() below.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi
// Punctuation that usually ends the sentence, not the URL.
const TRAILING_PUNCTUATION = '.,!?;:'
const CLOSING_TO_OPENING: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

function count(text: string, char: string): number {
  return text.split(char).length - 1
}

/**
 * Drop sentence punctuation from the end of a URL. A closing bracket is dropped only when it's
 * unbalanced, so "(see https://x.test/a)" loses the ")" but
 * "https://en.wikipedia.org/wiki/Foo_(bar)" keeps it.
 */
function trimTrailing(candidate: string): string {
  let url = candidate
  for (;;) {
    const last = url.at(-1)
    if (!last) return url
    const opening = CLOSING_TO_OPENING[last]
    const strip = TRAILING_PUNCTUATION.includes(last)
      ? true
      : opening !== undefined && count(url, opening) < count(url, last)
    if (!strip) return url
    url = url.slice(0, -1)
  }
}

function safeHttpUrl(candidate: string): string | null {
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

interface LinkifyOptions {
  /** e.g. -1 to keep links out of the tab order inside a roving-tabindex container. */
  tabIndex?: number
}

/**
 * Split plain text into strings and external links, for rendering as React children (never
 * as HTML). Only http(s) URLs become links; everything else stays text, escaped by React.
 */
export function linkify(text: string, { tabIndex }: LinkifyOptions = {}): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index
    const raw = trimTrailing(match[0])

    const href = safeHttpUrl(raw)
    if (!href) continue

    if (start > lastIndex) parts.push(text.slice(lastIndex, start))
    parts.push(
      <a
        key={`${start}-${raw}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        tabIndex={tabIndex}
        className="break-all text-primary underline underline-offset-2 hover:no-underline"
      >
        {raw}
      </a>,
    )
    lastIndex = start + raw.length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
