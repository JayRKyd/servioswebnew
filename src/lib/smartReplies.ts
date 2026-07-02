/**
 * Smart reply suggestion engine.
 *
 * Phase 1: Static keyword-based suggestions.
 * Phase 2: Swap `generateSuggestions` internals to call Claude API —
 *          the hook interface stays identical, no UI changes needed.
 */

export interface SmartReplyContext {
  lastMessage: string       // the most recent message text (not from current user)
  bookingStatus?: string    // optional booking context
  senderRole?: string       // role of the message sender
}

type SuggestionRule = {
  keywords: RegExp
  suggestions: string[]
}

const RULES: SuggestionRule[] = [
  // Greeting
  {
    keywords: /\b(hello|hi|hey|good morning|good afternoon|good evening)\b/i,
    suggestions: ['Hi! How can I help?', 'Hello! Thanks for reaching out.', 'Hi there!'],
  },
  // Job complete / done
  {
    keywords: /\b(done|finished|complete|completed|all done|job done|wrapped up)\b/i,
    suggestions: ["Thanks for letting me know!", "Great work, I'll release payment shortly.", "Noted, I'll review and confirm."],
  },
  // On my way / arriving
  {
    keywords: /\b(on my way|heading over|en route|be there|arriving|almost there)\b/i,
    suggestions: ["Great, I'll be ready!", "Perfect, the door is unlocked.", "Thanks for the heads up."],
  },
  // Running late / delay
  {
    keywords: /\b(running late|delayed|stuck|traffic|sorry for|behind schedule)\b/i,
    suggestions: ["No worries, take your time.", "Thanks for letting me know!", "Okay, I'll adjust accordingly."],
  },
  // Quote / price
  {
    keywords: /\b(quote|price|cost|estimate|charge|fee|rate)\b/i,
    suggestions: ["That price works for me.", "Can you break down the costs?", "Thanks for the estimate, I'll review it."],
  },
  // Scheduling / date / time
  {
    keywords: /\b(schedule|reschedule|time|date|appointment|available|availability|when)\b/i,
    suggestions: ["That time works for me.", "Can we do a different day?", "I'll confirm the time shortly."],
  },
  // Payment / invoice
  {
    keywords: /\b(payment|invoice|paid|transfer|deposit|receipt)\b/i,
    suggestions: ["Payment has been sent.", "I'll process payment now.", "Can you send an invoice?"],
  },
  // Photos / photos uploaded
  {
    keywords: /\b(photo|picture|image|before|after|pic)\b/i,
    suggestions: ["Thanks, I can see the photos!", "Looks great!", "The work looks excellent."],
  },
  // Booking status: accepted
  {
    keywords: /\b(accept|confirmed|booked|secured)\b/i,
    suggestions: ["Great, see you then!", "Confirmed, I'll be ready.", "Thanks for confirming!"],
  },
  // Booking status: rejected / cancel
  {
    keywords: /\b(cancel|reject|decline|unable|unavailable|not available)\b/i,
    suggestions: ["Understood, thank you.", "No problem, I'll find another provider.", "Thanks for letting me know."],
  },
  // Questions
  {
    keywords: /\?$/,
    suggestions: ["Yes, that's correct.", "Let me check and get back to you.", "Could you give me more details?"],
  },
  // Thank you
  {
    keywords: /\b(thank you|thanks|appreciate|grateful)\b/i,
    suggestions: ["You're welcome!", "Happy to help!", "My pleasure!"],
  },
]

// Booking-status-specific overrides
const STATUS_SUGGESTIONS: Record<string, string[]> = {
  pending: ["Still reviewing your request.", "I'll confirm shortly.", "Just checking availability."],
  accepted: ["Looking forward to it!", "See you at the scheduled time.", "I'll be ready!"],
  in_progress: ["Work is going smoothly.", "Almost done!", "Any specific requests before I finish?"],
  completed: ["Thanks for the great work!", "I'll release payment now.", "Will leave a review shortly."],
}

// Customer-specific overrides: replies a customer sends TO a provider
const CUSTOMER_RULES: SuggestionRule[] = [
  // Provider greeting
  {
    keywords: /\b(hello|hi|hey|good morning|good afternoon|good evening)\b/i,
    suggestions: ["Hi! Yes, I need help with this.", "Hello! Thanks for getting back to me.", "Hi there! Happy to discuss."],
  },
  // Provider asking for details / clarification
  {
    keywords: /\?(.*)?$/,
    suggestions: ["Yes, that's right.", "It's at my property in London.", "I'm available from Monday onwards."],
  },
  // Provider says they're on the way / arriving
  {
    keywords: /\b(on my way|heading over|en route|be there|arriving|almost there)\b/i,
    suggestions: ["Great, I'll be home!", "Perfect, the door will be open.", "Thanks for the heads up."],
  },
  // Provider mentions job completion
  {
    keywords: /\b(done|finished|complete|completed|all done|job done|wrapped up)\b/i,
    suggestions: ["Thanks for the great work!", "I'll release payment now.", "Will leave a review shortly."],
  },
  // Provider sends a quote / price
  {
    keywords: /\b(quote|price|cost|estimate|charge|fee|rate)\b/i,
    suggestions: ["That works for me, let's go ahead.", "Can you break down the costs?", "Thanks, I'll confirm shortly."],
  },
  // Provider mentions scheduling
  {
    keywords: /\b(schedule|reschedule|time|date|appointment|available|availability|when)\b/i,
    suggestions: ["That time works for me.", "Can we do a different day?", "I'll confirm by tomorrow."],
  },
  // Provider asks for photos
  {
    keywords: /\b(photo|picture|image|before|after|pic)\b/i,
    suggestions: ["I'll send photos now.", "Here are the photos — let me know if you need more.", "The issue is visible in the last photo."],
  },
  // Provider thanks customer
  {
    keywords: /\b(thank you|thanks|appreciate|grateful)\b/i,
    suggestions: ["You're welcome!", "Happy to!", "Looking forward to it."],
  },
  // Provider running late
  {
    keywords: /\b(running late|delayed|stuck|traffic|sorry for|behind schedule)\b/i,
    suggestions: ["No worries, take your time.", "Thanks for letting me know.", "Okay, I'll be here."],
  },
]

/**
 * Returns up to 3 smart reply suggestions given the last received message.
 * Falls back to a small set of generic suggestions if no rules match.
 *
 * Future: replace this function body with a fetch to /api/v1/smart-reply
 * that calls the Claude API. The returned `string[]` shape stays the same.
 */
export function generateSuggestions({ lastMessage, bookingStatus, senderRole }: SmartReplyContext): string[] {
  const isCustomer = senderRole === 'customer'
  const rules = isCustomer ? CUSTOMER_RULES : RULES
  const matched: string[] = []

  for (const rule of rules) {
    if (rule.keywords.test(lastMessage)) {
      matched.push(...rule.suggestions)
      if (matched.length >= 4) break
    }
  }

  // Mix in booking-status suggestions if relevant (provider only)
  if (!isCustomer && bookingStatus && STATUS_SUGGESTIONS[bookingStatus] && matched.length < 3) {
    matched.push(...STATUS_SUGGESTIONS[bookingStatus])
  }

  // Deduplicate and limit
  const unique = Array.from(new Set(matched))
  if (unique.length >= 2) return unique.slice(0, 3)

  // Generic fallback
  return isCustomer
    ? ["Yes, that sounds good.", "Happy to proceed.", "I'll get back to you shortly."]
    : ["Thanks!", "Got it.", "I'll follow up shortly."]
}
