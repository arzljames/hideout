import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Field, FieldError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { messageFormSchema, type MessageFormValues } from '../message-body-schema'

interface MessageEditorProps {
  /** The text to start from (the message body, or a failed save's text). */
  initialText: string
  /** A server (422) error to show at once. */
  initialError?: string
  /** Called with a valid, changed body. */
  onSave: (body: string) => void
  /** Esc, or saving an unchanged body. */
  onCancel: () => void
  className?: string
}

/**
 * Inline editor that replaces a message's body: Enter saves, Shift+Enter adds a line, Escape
 * cancels. Takes focus when it opens (the caller returns focus to the row when it closes).
 */
export function MessageEditor({
  initialText,
  initialError,
  onSave,
  onCancel,
  className,
}: MessageEditorProps) {
  const ids = { input: useId(), hint: useId(), error: useId() }
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { body: initialText },
  })

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    if (initialError) form.setError('body', { type: 'server', message: initialError })
  }, [form, initialError])

  function onValid({ body }: MessageFormValues) {
    if (body === initialText && !initialError) onCancel()
    else onSave(body)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const composing = event.nativeEvent.isComposing || event.keyCode === 229
    if (composing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void form.handleSubmit(onValid)()
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(onValid)(event)}
      className={cn('py-1', className)}
    >
      <Controller
        name="body"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <label htmlFor={ids.input} className="sr-only">
              Edit message
            </label>
            <Textarea
              {...field}
              ref={(node) => {
                textareaRef.current = node
                field.ref(node)
              }}
              id={ids.input}
              rows={1}
              onKeyDown={handleKeyDown}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? `${ids.error} ${ids.hint}` : ids.hint}
              className="max-h-60 min-h-9 resize-none overflow-y-auto"
            />
            {fieldState.invalid && <FieldError id={ids.error} errors={[fieldState.error]} />}
            <p id={ids.hint} className="text-xs text-muted-foreground">
              Enter to save · Shift+Enter for a new line · Esc to cancel
            </p>
          </Field>
        )}
      />
    </form>
  )
}
