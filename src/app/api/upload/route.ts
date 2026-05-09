import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // TODO: integrate with Supabase Storage
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Placeholder — replace with actual Supabase Storage upload
  return NextResponse.json({ url: '', message: 'Upload endpoint not yet implemented' }, { status: 501 })
}
