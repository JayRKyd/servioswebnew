export type Role = 'customer' | 'provider' | 'landlord' | 'tenant' | 'admin'

export interface UserProfile {
  id: string
  email: string
  phone: string
  roles: Role[]
  active_role: Role
  primary_role: Role
  created_at: string
  customer_profiles?: CustomerProfile[]
  provider_profiles?: ProviderProfile[]
  landlord_profiles?: LandlordProfile[]
  tenant_profiles?: TenantProfile[]
}

export interface CustomerProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  avatar_url?: string
}

export interface ProviderProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  business_name: string
  bio?: string
  avatar_url?: string
  hourly_rate?: number
  rating_average: number
  rating_count: number
  is_verified: boolean
  is_active: boolean
  islands: string[]
  max_travel_distance?: number
}

export interface LandlordProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  avatar_url?: string
}

export interface TenantProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  property_id?: string
}

export interface Booking {
  id: string
  booking_number: string
  customer_id?: string
  provider_id: string
  service_id: string
  landlord_id?: string
  property_id?: string
  tenant_id?: string
  maintenance_request_id?: string
  scheduled_date: string
  scheduled_time_start: string
  scheduled_time_end?: string
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled'
  base_amount: number
  travel_fee: number
  platform_fee: number
  total_amount: number
  commission_rate: number
  booking_type: 'direct_customer' | 'landlord_direct' | 'tenant_request'
  payer_type: 'customer' | 'landlord'
  payer_id: string
  payment_status: 'unpaid' | 'paid' | 'refunded'
  is_emergency: boolean
  customer_notes?: string
  created_at: string
}

export interface Property {
  id: string
  landlord_id: string
  name: string
  property_type: 'residential' | 'commercial' | 'vacation_rental' | 'multi_unit'
  address: Address
  units?: number
  bedrooms?: number
  bathrooms?: number
  square_feet?: number
  year_built?: number
  notes?: string
  created_at: string
}

export interface Address {
  street: string
  city: string
  island: string
  postalCode?: string
  coordinates?: { lat: number; lng: number }
}

export interface MaintenanceRequest {
  id: string
  property_id: string
  landlord_id: string
  tenant_id?: string
  reported_by: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'emergency'
  category?: string
  photos: string[]
  status: 'pending' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  attachments: string[]
  read_at?: string
  created_at: string
}

export interface Conversation {
  id: string
  booking_id?: string
  maintenance_request_id?: string
  created_by: string
  updated_at: string
  participants: ConversationParticipant[]
}

export interface ConversationParticipant {
  id: string
  conversation_id: string
  user_id: string
  last_read_at?: string
}

export interface Service {
  id: string
  title: string
  description?: string
  category: string
}

export interface Review {
  id: string
  booking_id: string
  provider_id: string
  reviewer_id: string
  rating: number
  comment?: string
  created_at: string
}

export interface Invitation {
  id: string
  landlord_id: string
  provider_id: string
  property_id?: string
  message?: string
  custom_commission_rate?: number
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}
