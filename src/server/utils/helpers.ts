export function generateBookingNumber(): string {
  return `SRV-${new Date().getFullYear()}-${Date.now()}`
}

export function paginate(page: number, limit: number) {
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { from, to }
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-BS', { style: 'currency', currency }).format(amount)
}

export const BAHAMAS_ISLANDS = [
  'New Providence',
  'Grand Bahama',
  'Abaco',
  'Eleuthera',
  'Exuma',
  'Andros',
  'Long Island',
  'Cat Island',
  'San Salvador',
  'Bimini',
  'Berry Islands',
  'Inagua',
  'Mayaguana',
  'Crooked Island',
  'Acklins',
  'Ragged Island',
] as const

export type BahamasIsland = typeof BAHAMAS_ISLANDS[number]
