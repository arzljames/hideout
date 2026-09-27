import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { isApplePlatform } from '../lib/platform'

interface ShortcutKeysOptions {
  keyName: string
  mac: boolean
}

/** "Ctrl + Shift + M", or "⌘ + Shift + M" on Apple platforms. */
function shortcutKeys({ keyName, mac }: ShortcutKeysOptions) {
  return (
    <KbdGroup>
      {mac ? (
        <Kbd>
          <span aria-hidden="true">⌘</span>
          <span className="sr-only">Command</span>
        </Kbd>
      ) : (
        <Kbd>Ctrl</Kbd>
      )}
      +<Kbd>Shift</Kbd>+<Kbd>{keyName}</Kbd>
    </KbdGroup>
  )
}

interface VoiceShortcutsProps {
  className?: string
}

/** Mute/deafen shortcut hints, with ⌘ on Apple platforms. */
export function VoiceShortcuts({ className }: VoiceShortcutsProps) {
  // Bound by useVoiceShortcuts while in voice. They override the browser's own Ctrl+Shift+M
  // (Firefox responsive design mode) and Ctrl+Shift+D (Chrome bookmark all tabs) only then.
  const mac = isApplePlatform()

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground',
        className,
      )}
    >
      <span>Shortcuts:</span>
      <span className="inline-flex items-center gap-1">
        Mute {shortcutKeys({ keyName: 'M', mac })}
      </span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        Deafen {shortcutKeys({ keyName: 'D', mac })}
      </span>
    </p>
  )
}
