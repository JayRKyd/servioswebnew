'use client'
import { useState, useCallback } from 'react'

export type GeoLocation = { lat: number; lng: number }

export function useGeolocation() {
  const [location, setLocation]   = useState<GeoLocation | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [granted, setGranted]     = useState(false)

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGranted(true)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
      { timeout: 10_000, maximumAge: 60_000 }
    )
  }, [])

  return { location, loading, error, granted, requestLocation }
}
