import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const messages = new Hono()

messages.use('*', authMiddleware)

const createConversationSchema = z.object({
  participantId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  maintenanceRequestId: z.string().uuid().optional(),
})

const sendMessageSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.string().url()).optional(),
})

// GET /conversations
messages.get('/conversations', async (c) => {
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('conversation_participants')
    .select('conversation:conversations(*, participants:conversation_participants(user:users(id, customer_profiles(*), provider_profiles(*))))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, referencedTable: 'conversations' })

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ conversations: data?.map((d) => d.conversation) })
})

// GET /conversations/:id/messages
messages.get('/conversations/:id/messages', async (c) => {
  const conversationId = c.req.param('id')
  const userId = c.get('userId')
  const limit = Number(c.req.query('limit') ?? 50)
  const before = c.req.query('before')

  // Verify participant
  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single()

  if (!participant) throw new HTTPException(403, { message: 'Forbidden' })

  let query = supabase
    .from('messages')
    .select('*, sender:users(id, customer_profiles(first_name, last_name), provider_profiles(first_name, last_name))')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ messages: data?.reverse() })
})

// POST /conversations — create or get existing
messages.post('/conversations', zValidator('json', createConversationSchema), async (c) => {
  const userId = c.get('userId')
  const { participantId, bookingId, maintenanceRequestId } = c.req.valid('json')

  // Check for existing conversation between these two users
  const { data: existing } = await supabase
    .rpc('find_conversation', { user1: userId, user2: participantId })

  if (existing?.id) {
    return c.json({ conversation: existing })
  }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      booking_id: bookingId,
      maintenance_request_id: maintenanceRequestId,
      created_by: userId,
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })

  // Add both participants
  await supabase.from('conversation_participants').insert([
    { conversation_id: conversation.id, user_id: userId },
    { conversation_id: conversation.id, user_id: participantId },
  ])

  return c.json({ conversation }, 201)
})

// POST /conversations/:id/messages
messages.post('/conversations/:id/messages', zValidator('json', sendMessageSchema), async (c) => {
  const conversationId = c.req.param('id')
  const userId = c.get('userId')
  const { content, attachments } = c.req.valid('json')

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single()

  if (!participant) throw new HTTPException(403, { message: 'Forbidden' })

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: userId, content, attachments: attachments || [] })
    .select('*, sender:users(id)')
    .single()

  if (error) throw new HTTPException(400, { message: error.message })

  // Update conversation updated_at
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

  return c.json({ message: data }, 201)
})

// PUT /conversations/:id/read
messages.put('/conversations/:id/read', async (c) => {
  const conversationId = c.req.param('id')
  const userId = c.get('userId')

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  return c.json({ message: 'Marked as read' })
})

export { messages as messageRoutes }
