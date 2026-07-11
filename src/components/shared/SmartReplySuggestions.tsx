'use client'

interface SmartReplySuggestionsProps {
  suggestions: string[]
  onSelect: (text: string) => void
}

export function SmartReplySuggestions({ suggestions, onSelect }: SmartReplySuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-1 py-1">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/[0.12] active:scale-95"
        >
          {s}
        </button>
      ))}
    </div>
  )
}
