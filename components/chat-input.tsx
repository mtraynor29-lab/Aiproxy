'use client'

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

export function ChatInput({
  onSend,
  isStreaming,
  onStop,
}: {
  onSend: (text: string) => void
  isStreaming: boolean
  onStop: () => void
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const submit = () => {
    if (!value.trim() || isStreaming) return
    onSend(value)
    setValue('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-3 sm:px-6">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-input px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              resize()
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Send a message..."
            aria-label="Message"
            className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:opacity-90"
            >
              <span className="h-3 w-3 rounded-[3px] bg-foreground" aria-hidden />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex h-9 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-2 px-1 text-center font-mono text-[11px] text-muted-foreground">
          Press Enter to send, Shift+Enter for a new line
        </p>
      </form>
    </div>
  )
}
