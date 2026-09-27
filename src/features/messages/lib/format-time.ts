const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** "9:41 PM" (in the user's locale), for a message's createdAt. */
export function formatMessageTime(iso: string): string {
  return timeFormat.format(new Date(iso))
}

/** "Sep 27, 2026, 9:41 PM", e.g. for when a message was edited. */
export function formatMessageDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "Today", "Yesterday", or a medium date, for day dividers. */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return dateFormat.format(new Date(iso))
}
