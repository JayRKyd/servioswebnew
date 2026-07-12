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

// Provider-facing rules: the provider is replying to a customer who is
// enquiring about or has booked their service.
const RULES: SuggestionRule[] = [
  // Customer greeting
  {
    keywords: /\b(hello|hi|hey|good morning|good afternoon|good evening)\b/i,
    suggestions: ['Hi! How can I help?', 'Hello! Thanks for reaching out.', 'Hi there — what can I do for you?'],
  },
  // Customer says the job is done / thanks for finishing
  {
    keywords: /\b(done|finished|complete|completed|all done|job done|wrapped up)\b/i,
    suggestions: ["Glad it's all sorted!", "Happy to help — let me know if anything else comes up.", "Thanks! I'll send the invoice shortly."],
  },
  // Arrival / access
  {
    keywords: /\b(on my way|heading over|en route|be there|arriving|almost there)\b/i,
    suggestions: ["Great, see you shortly!", "Perfect, I'm on my way.", "Thanks — I'll be there soon."],
  },
  // Running late / delay
  {
    keywords: /\b(running late|delayed|stuck|traffic|sorry for|behind schedule)\b/i,
    suggestions: ["No problem, take your time.", "Thanks for letting me know.", "No worries — see you when you arrive."],
  },
  // Quote / price — provider is being asked for pricing
  {
    keywords: /\b(quote|price|cost|estimate|charge|fee|rate)\b/i,
    suggestions: ["Happy to put together a quote for you.", "I'll send you an estimate shortly.", "Can you share a bit more detail so I can price it accurately?"],
  },
  // Scheduling / date / time
  {
    keywords: /\b(schedule|reschedule|time|date|appointment|available|availability|when)\b/i,
    suggestions: ["That works for me.", "Let me check my calendar and confirm.", "I can do that — I'll confirm shortly."],
  },
  // Payment / invoice — provider receives payment
  {
    keywords: /\b(payment|invoice|paid|transfer|deposit|receipt)\b/i,
    suggestions: ["Thanks, payment received!", "I'll send the invoice over now.", "No problem — I'll get the invoice to you."],
  },
  // Photos — customer sends photos of the problem
  {
    keywords: /\b(photo|picture|image|before|after|pic)\b/i,
    suggestions: ["Thanks — that helps me understand the issue.", "Got it, I can see the problem.", "Thanks for the photos, I'll take a look."],
  },
  // Booking accepted / confirmed
  {
    keywords: /\b(accept|confirmed|booked|secured)\b/i,
    suggestions: ["Great, see you then!", "Confirmed — I'll be there.", "Thanks for confirming!"],
  },
  // Cancellation
  {
    keywords: /\b(cancel|reject|decline|unable|unavailable|not available)\b/i,
    suggestions: ["No problem, thanks for letting me know.", "Understood — reach out anytime.", "No worries, happy to help another time."],
  },
  // Questions
  {
    keywords: /\?$/,
    suggestions: ["Yes, that's correct.", "Let me check and get back to you.", "Sure — happy to explain."],
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
