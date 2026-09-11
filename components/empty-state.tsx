const SUGGESTIONS = [
  'Explain how a reverse proxy works',
  'Write a haiku about network security',
  'Summarize the OSI model in plain English',
  'Give me 3 tips for writing clean TypeScript',
]

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center sm:py-20">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
      </div>
      <h2 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
        How can I help you today?
      </h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        Start a conversation with the HCNSEC AI model. Responses stream in real time.
      </p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-card-foreground transition-colors hover:border-ring hover:bg-muted"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
