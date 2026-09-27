import { zodResolver } from '@hookform/resolvers/zod'
import { SendHorizontal } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSendMessage } from '../api'
import {
  countCodePoints,
  MESSAGE_BODY_MESSAGES,
  MESSAGE_MAX_LENGTH,
  messageBodyIssue,
  messageFormSchema,
  type MessageFormValues,
} from '../message-body-schema'
import { getDraft, setDraft, useDraftRevision } from '../pending-messages-store'

interface ComposerProps {
  roomId: string
  channelId: string
  channelName: string
  /** ArrowUp in an empty composer: edit your last message. Return true if an editor opened. */
  onEditLast?: () => boolean
  className?: string
}

/**
 * Message input. Enter (or the Send button) sends the text as typed (not trimmed),
 * Shift+Enter adds a line, and the textarea grows to about eight lines before it scrolls. The
 * draft is kept per channel while the tab is open.
 */
export function Composer({ roomId, channelId, channelName, onEditLast, className }: ComposerProps) {
  const ids = { input: useId(), hint: useId(), counter: useId(), error: useId() }
  const { send } = useSendMessage(roomId, channelId)
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { body: getDraft(channelId) },
  })
  const body = useWatch({ control: form.control, name: 'body' })
  const issue = messageBodyIssue(body)
  const length = countCodePoints(body)
  // Blank is simply "nothing to send"; other problems are shown under the input.
  const visibleIssue = issue && issue !== 'blank' ? MESSAGE_BODY_MESSAGES[issue] : null

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const { ref: registerRef, ...bodyField } = form.register('body', {
    onChange: (event: { target: { value: string } }) => setDraft(channelId, event.target.value),
  })
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      registerRef(node)
    },
    [registerRef],
  )

  // A draft restored from outside (a failed message's "Edit"): take it and focus.
  const draftRevision = useDraftRevision(channelId)
  const seenRevision = useRef(draftRevision)
  useEffect(() => {
    if (draftRevision === seenRevision.current) return
    seenRevision.current = draftRevision
    const draft = getDraft(channelId)
    form.setValue('body', draft)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(draft.length, draft.length)
    }
  }, [channelId, draftRevision, form])

  // Auto-grow: fallback for browsers without `field-sizing: content`. CSS max-height caps it.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [body])

  function onValid(values: MessageFormValues) {
    send(values.body)
    form.reset({ body: '' })
    setDraft(channelId, '')
    // Keep typing flow: after a click on Send (now disabled), focus goes back to the input.
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Don't send while an IME is composing (e.g. Japanese input confirms with Enter).
    const composing = event.nativeEvent.isComposing || event.keyCode === 229
    if (composing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!issue) void form.handleSubmit(onValid)()
    } else if (
      event.key === 'ArrowUp' &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.currentTarget.value === '' &&
      onEditLast?.()
    ) {
      event.preventDefault()
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!issue) void form.handleSubmit(onValid)(event)
      }}
      className={cn('px-4 pb-4', className)}
    >
      <label htmlFor={ids.input} className="sr-only">
        Message #{channelName}
      </label>
      <div className="relative">
        <Textarea
          {...bodyField}
          ref={setTextareaRef}
          id={ids.input}
          rows={1}
          onKeyDown={handleKeyDown}
          enterKeyHint="send"
          placeholder={`Message #${channelName}`}
          aria-invalid={visibleIssue ? true : undefined}
          aria-describedby={cn(visibleIssue && ids.error, ids.hint, ids.counter)}
          className="max-h-44 min-h-11 resize-none overflow-y-auto pr-12"
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label="Send message"
            disabled={issue !== null}
          >
            <SendHorizontal aria-hidden="true" />
          </Button>
        </div>
      </div>
      {visibleIssue && (
        <p id={ids.error} className="mt-1.5 text-xs text-destructive">
          {visibleIssue}
        </p>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <p id={ids.hint}>Enter to send · Shift+Enter for a new line</p>
        {/* Described by the textarea, deliberately not a live region. */}
        <p
          id={ids.counter}
          className={cn('tabular-nums', length > MESSAGE_MAX_LENGTH && 'text-destructive')}
        >
          {length} / {MESSAGE_MAX_LENGTH} <span className="sr-only">characters</span>
        </p>
      </div>
    </form>
  )
}
