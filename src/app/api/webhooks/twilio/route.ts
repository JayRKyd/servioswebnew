import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // TODO: handle Twilio SMS/voice webhooks
  const body = await req.formData()
  console.log('Twilio webhook:', Object.fromEntries(body))
  return NextResponse.json({ received: true })
}
