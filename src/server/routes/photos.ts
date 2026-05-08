import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const photos = new Hono()

photos.use('*', authMiddleware)

// GET /api/v1/bookings/:bookingId/photos
photos.get('/:bookingId/photos', async (c) => {
  const userId = c.get('userId')
  const { bookingId } = c.req.param()

  // Verify requester is party to the booking
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, customer_id, provider_id, property_id')
    .eq('id', bookingId)
    .single()

  if (bErr || !booking) throw new HTTPException(404, { message: 'Booking not found' })

  // Check if requester is landlord of the property
  let isLandlord = false
  if (booking.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('landlord_id')
      .eq('id', booking.property_id)
      .single()
    isLandlord = prop?.landlord_id === userId
  }

  const isParty =
    booking.customer_id === userId ||
    booking.provider_id === userId ||
    isLandlord

  if (!isParty) throw new HTTPException(403, { message: 'Forbidden' })

  const { data: rawPhotos, error } = await supabase
    .from('booking_photos')
    .select('id, url, storage_path, type, caption, uploaded_by, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  if (error) throw new HTTPException(500, { message: error.message })

  // Generate signed URLs (1 hour expiry)
  const photosWithSignedUrls = await Promise.all(
    (rawPhotos ?? []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from('booking-photos')
        .createSignedUrl(photo.storage_path, 3600)
      return {
        ...photo,
        signed_url: signed?.signedUrl ?? photo.url,
      }
    })
  )

  return c.json({ photos: photosWithSignedUrls })
})

// POST /api/v1/bookings/:bookingId/photos
// Body: multipart/form-data with file + type + caption
photos.post(
  '/:bookingId/photos',
  async (c) => {
    const userId = c.get('userId')
    const { bookingId } = c.req.param()

    // Must be the provider for this booking
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, provider_id, status')
      .eq('id', bookingId)
      .single()

    if (bErr || !booking) throw new HTTPException(404, { message: 'Booking not found' })
    if (booking.provider_id !== userId) throw new HTTPException(403, { message: 'Only the provider can upload photos' })
    if (!['in_progress', 'completed'].includes(booking.status)) {
      throw new HTTPException(400, { message: 'Can only upload photos for in-progress or completed bookings' })
    }

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const caption = formData.get('caption') as string | null
    const marketingConsent = formData.get('marketing_consent') === 'true'

    if (!file) throw new HTTPException(400, { message: 'file is required' })
    if (!type || !['before', 'after'].includes(type)) {
      throw new HTTPException(400, { message: 'type must be "before" or "after"' })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${userId}/${bookingId}/${type}_${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('booking-photos')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) throw new HTTPException(500, { message: `Upload failed: ${uploadError.message}` })

    // Get public URL (will be converted to signed URL on read)
    const { data: publicData } = supabase.storage
      .from('booking-photos')
      .getPublicUrl(storagePath)

    const { data: photo, error: dbErr } = await supabase
      .from('booking_photos')
      .insert({
        booking_id: bookingId,
        uploaded_by: userId,
        url: publicData.publicUrl,
        storage_path: storagePath,
        type,
        caption: caption ?? null,
        marketing_consent: marketingConsent,
        consent_given_at: marketingConsent ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (dbErr) throw new HTTPException(500, { message: dbErr.message })

    return c.json({ photo }, 201)
  }
)

// PATCH /api/v1/bookings/:bookingId/photos/:photoId/consent — toggle marketing consent
photos.patch('/:bookingId/photos/:photoId/consent', async (c) => {
  const userId = c.get('userId')
  const { bookingId, photoId } = c.req.param()
  const { marketing_consent } = await c.req.json<{ marketing_consent: boolean }>()

  const { data: photo } = await supabase
    .from('booking_photos')
    .select('uploaded_by')
    .eq('id', photoId)
    .eq('booking_id', bookingId)
    .single()

  if (!photo || photo.uploaded_by !== userId) throw new HTTPException(403, { message: 'Forbidden' })

  const { data, error } = await supabase
    .from('booking_photos')
    .update({
      marketing_consent,
      consent_given_at: marketing_consent ? new Date().toISOString() : null,
    })
    .eq('id', photoId)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ photo: data })
})

// DELETE /api/v1/bookings/:bookingId/photos/:photoId
photos.delete('/:bookingId/photos/:photoId', async (c) => {
  const userId = c.get('userId')
  const { bookingId, photoId } = c.req.param()

  const { data: photo, error } = await supabase
    .from('booking_photos')
    .select('id, storage_path, uploaded_by, booking_id')
    .eq('id', photoId)
    .eq('booking_id', bookingId)
    .single()

  if (error || !photo) throw new HTTPException(404, { message: 'Photo not found' })
  if (photo.uploaded_by !== userId) throw new HTTPException(403, { message: 'Forbidden' })

  await supabase.storage.from('booking-photos').remove([photo.storage_path])

  await supabase.from('booking_photos').delete().eq('id', photoId)

  return c.json({ success: true })
})

export { photos as photoRoutes }
