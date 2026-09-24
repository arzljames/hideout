import { zodResolver } from '@hookform/resolvers/zod'
import { SendHorizontal, Smile } from 'lucide-react'
import { useCallback, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  composerDefaults,
  composerSchema,
  MESSAGE_MAX_LENGTH,
  type ComposerValues,
} from '../composer-schema'

interface ComposerProps {
  channelName: string
  className?: string
}

/**
 * Message input. Enter (or the Send button) sends, Shift+Enter adds a line, and the textarea
 * grows to about eight lines before it scrolls.
 */
export function Composer({ channelName, className }: ComposerProps) {
  const ids = { input: useId(), hint: useId(), counter: useId() }
  const form = useForm<ComposerValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: composerDefaults,
  })
  const content = useWatch({ control: form.control, name: 'content' })
  const blank = content.trim().length === 0

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const { ref: registerRef, ...contentField } = form.register('content')
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      registerRef(node)
    },
    [registerRef],
  )

  // Auto-grow: fallback for browsers without `field-sizing: content`. CSS max-height caps it.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [content])

  function onValid() {
    // TODO(api): optimistic send with Idempotency-Key (temp id, reconcile on Realtime insert).
    form.reset(composerDefaults)
    // Keep typing flow: after a click on Send (now disabled), focus goes back to the input.
    // (Not form.setFocus: reset() drops field refs until the next render.)
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Don't send while an IME is composing (e.g. Japanese input confirms with Enter).
    const composing = event.nativeEvent.isComposing || event.keyCode === 229
    if (event.key === 'Enter' && !event.shiftKey && !composing) {
      event.preventDefault()
      // A blank message is simply not sent; no error message for an empty Enter.
      if (!blank) void form.handleSubmit(onValid)()
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(onValid)(event)}
      className={cn('px-4 pb-4', className)}
    >
      <label htmlFor={ids.input} className="sr-only">
        Message #{channelName}
      </label>
      <div className="relative">
        <Textarea
          {...contentField}
          ref={setTextareaRef}
          id={ids.input}
          rows={1}
          onKeyDown={handleKeyDown}
          maxLength={MESSAGE_MAX_LENGTH}
          enterKeyHint="send"
          placeholder={`Message #${channelName}`}
          aria-describedby={`${ids.hint} ${ids.counter}`}
          className="max-h-44 min-h-11 resize-none overflow-y-auto pr-20"
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
          {/* TODO(messages): open an emoji picker Popover. */}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Add emoji">
            <Smile aria-hidden="true" />
          </Button>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label="Send message"
            disabled={blank}
          >
            <SendHorizontal aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <p id={ids.hint}>Enter to send · Shift+Enter for a new line</p>
        {/* Described by the textarea, deliberately not a live region. */}
        <p id={ids.counter} className="tabular-nums">
          {content.length} / {MESSAGE_MAX_LENGTH}{' '}
          <span className="sr-only">characters</span>
        </p>
      </div>
    </form>
  )
}
