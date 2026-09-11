import type { Message } from './chat'

export function ChatMessage({
  message,
  isStreaming,
}: {
  message: Message
  isStreaming: boolean
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="px-1 font-mono text-xs text-muted-foreground">
          {isUser ? 'you' : 'assistant'}
        </span>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-card-foreground'
          }`}
        >
          {message.content}
          {isStreaming && (
            <span className="animate-blink font-mono text-primary" aria-hidden>
              ▍
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
