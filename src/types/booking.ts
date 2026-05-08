export interface Booking {
  id: string
  booking_number: string
  scheduled_date: string
  scheduled_time_start: string
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled'
  total_amount: number
  is_emergency: boolean
}
