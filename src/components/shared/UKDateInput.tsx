'use client'
import { useState, useEffect, useRef } from 'react'

interface UKDateInputProps {
  value: string           // YYYY-MM-DD or ''
  onChange: (value: string) => void  // always emits YYYY-MM-DD or ''
  className?: string
  placeholder?: string
  min?: string            // YYYY-MM-DD
  disabled?: boolean
  required?: boolean
}

/** Converts YYYY-MM-DD → DD/MM/YYYY for display */
function toDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

/** Converts DD/MM/YYYY → YYYY-MM-DD for storage; returns '' if invalid */
function toISO(display: string): string {
  const clean = display.replace(/[^\d/]/g, '')
  const parts  = clean.split('/')
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  if (!d || !m || !y || y.length !== 4) return ''
  const day   = parseInt(d, 10)
  const month = parseInt(m, 10)
  const year  = parseInt(y, 10)
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return ''
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** Auto-inserts slashes as the user types: 2 → 2/, 25 → 25/ */
function autoSlash(raw: string, prev: string): string {
  let s = raw.replace(/[^\d/]/g, '')
  // Remove trailing slash when deleting
  if (raw.length < prev.length) return s
  if (s.length === 2 && !s.includes('/')) s += '/'
  if (s.length === 5 && s.split('/').length === 2) s += '/'
  return s.slice(0, 10)
}

export function UKDateInput({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY',
  min,
  disabled,
  required,
}: UKDateInputProps) {
  const [display, setDisplay] = useState(() => toDisplay(value))
  const prevDisplayRef = useRef(display)

  // Keep display in sync when parent changes value programmatically
  useEffect(() => {
    const incoming = toDisplay(value)
    if (incoming !== toDisplay(toISO(prevDisplayRef.current))) {
      setDisplay(incoming)
      prevDisplayRef.current = incoming
    }
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw    = e.target.value
    const slashed = autoSlash(raw, prevDisplayRef.current)
    prevDisplayRef.current = slashed
    setDisplay(slashed)
    const iso = toISO(slashed)
    // Validate min if provided
    if (iso && min && iso < min) return
    onChange(iso)
  }

  function handleBlur() {
    // Re-format on blur in case user typed partial input
    const iso = toISO(display)
    if (iso) {
      const formatted = toDisplay(iso)
      setDisplay(formatted)
      prevDisplayRef.current = formatted
    } else if (display.trim() === '') {
      setDisplay('')
      prevDisplayRef.current = ''
      onChange('')
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
      maxLength={10}
    />
  )
}
