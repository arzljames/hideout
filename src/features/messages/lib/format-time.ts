const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** "9:41 PM" (in the user's locale). */
export function formatMessageTime(iso: string): string {
  return timeFormat.format(new Date(iso))
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
