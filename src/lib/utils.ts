import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(date))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  return time.slice(0, 5)
}

/** Today's date as YYYY-MM-DD in the user's LOCAL timezone.
 *  `new Date().toISOString()` is UTC — in BST that blocks "today" bookings
 *  until 1am and mislabels calendar days after 11pm. */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return ''
  // Capitalise the first letter of each word; leave the rest of the word
  // untouched so acronyms like "NICEIC" and cased brands survive.
  return s
    .split(' ')
    .map(w => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}
