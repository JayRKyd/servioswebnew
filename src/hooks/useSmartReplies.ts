import { useMemo } from 'react'
import { generateSuggestions, SmartReplyContext } from '@/lib/smartReplies'

/**
 * Returns smart reply suggestions for the last received message.
 *
 * Usage:
 *   const suggestions = useSmartReplies({ lastMessage, bookingStatus })
 *   // → string[] of up to 3 suggestions
 *
 * When AI key is available: replace `generateSuggestions` with an API call
 * and add loading/error states. The component consuming this hook won't need
 * to change — just update the hook internals.
 */
export function useSmartReplies(context: SmartReplyContext | null): string[] {
  return useMemo(() => {
    if (!context?.lastMessage?.trim()) return []
    return generateSuggestions(context)
  }, [context?.lastMessage, context?.bookingStatus])
}
