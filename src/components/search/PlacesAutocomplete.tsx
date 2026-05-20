'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

declare global {
  interface Window {
    google: any
    _placesLoaded?: boolean
    _placesCallbacks?: (() => void)[]
  }
}

const PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? ''

export type PlaceResult = {
  label: string
  lat: number
  lng: number
}

function loadPlacesScript(onReady: () => void) {
  if (typeof window === 'undefined') return
  if (window._placesLoaded) { onReady(); return }

  if (!window._placesCallbacks) window._placesCallbacks = []
  window._placesCallbacks.push(onReady)

  const SCRIPT_ID = 'google-places-api'
  if (document.getElementById(SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = `https://maps.googleapis.com/maps/api/js?key=${PLACES_API_KEY}&libraries=places`
  script.async = true
  script.onload = () => {
    window._placesLoaded = true
    window._placesCallbacks?.forEach((cb) => cb())
    window._placesCallbacks = []
  }
  document.head.appendChild(script)
}

export function PlacesAutocomplete({
  value,
  onPlace,
  onClear,
  placeholder = 'Enter a postcode or area…',
  className = '',
}: {
  value: string
  onPlace: (place: PlaceResult) => void
  onClear: () => void
  placeholder?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [inputValue, setInputValue] = useState(value)

  // Sync display when parent clears the value
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || autocompleteRef.current) return
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'gb' },
      types: ['geocode'],
      fields: ['formatted_address', 'geometry'],
    })
    autocompleteRef.current = ac
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry?.location) return
      const label = place.formatted_address ?? inputRef.current?.value ?? ''
      setInputValue(label)
      onPlace({ label, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
    })
  }, [onPlace])

  useEffect(() => {
    if (!PLACES_API_KEY) return
    loadPlacesScript(initAutocomplete)
  }, [initAutocomplete])

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ' +
    className

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          if (!e.target.value) onClear()
        }}
        className={inputClass}
        autoComplete="off"
      />
      {inputValue && (
        <button
          type="button"
          onClick={() => { setInputValue(''); onClear() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
