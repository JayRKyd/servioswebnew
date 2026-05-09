export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  attachments: string[]
  created_at: string
}

export interface Conversation {
  id: string
  updated_at: string
  participants: { user_id: string }[]
}
