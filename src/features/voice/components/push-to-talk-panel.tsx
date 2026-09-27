import { Keyboard } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { keyLabel, RESERVED_PTT_KEYS } from '../voice-prefs'
import { useVoiceSession } from '../voice-session'

interface PushToTalkPanelProps {
  /** Waiting for the new key. Owned by the dialog, so Esc cancels instead of closing it. */
  capturing: boolean
  onCapturingChange: (capturing: boolean) => void
  className?: string
}

/** Current push-to-talk key and a way to change it. Only shown in push-to-talk mode. */
export function PushToTalkPanel({ capturing, onCapturingChange, className }: PushToTalkPanelProps) {
  const titleId = useId()
  const pttKey = useVoiceSession((s) => s.pttKey)
  const setPttKey = useVoiceSession((s) => s.setPttKey)
  const [rejected, setRejected] = useState(false)

  const setCapturing = (next: boolean) => {
    setRejected(false)
    onCapturingChange(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) return
    // Tab still moves focus (which cancels capture).
    if (event.code === 'Tab') return
    event.preventDefault()
    // Keep the key from reaching push-to-talk and shortcut listeners on window.
    event.stopPropagation()
    if (event.key === 'Escape') {
      setCapturing(false)
      return
    }
    // Enter and Space press buttons and links; keep waiting for another key.
    if (RESERVED_PTT_KEYS.has(event.code)) {
      setRejected(true)
      return
    }
    setPttKey(event.code)
    setCapturing(false)
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex items-center gap-3 rounded-lg border border-border p-3', className)}
    >
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="text-sm font-medium">
          Push-to-talk key
        </h3>
        <p className="text-xs text-muted-foreground">
          Hold it to talk. Works while Hideout is the active tab.
        </p>
        <p role="status" className="text-xs text-destructive empty:hidden">
          {capturing && rejected ? 'Enter and Space press buttons. Pick another key.' : ''}
        </p>
      </div>
      <Kbd>{keyLabel(pttKey)}</Kbd>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setCapturing(!capturing)}
        onKeyDown={onKeyDown}
        onBlur={() => setCapturing(false)}
      >
        <Keyboard aria-hidden="true" />
        <span aria-live="polite">{capturing ? 'Press a key…' : 'Change key'}</span>
      </Button>
    </section>
  )
}
