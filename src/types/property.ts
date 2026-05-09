export interface Property {
  id: string
  landlord_id: string
  name: string
  property_type: 'residential' | 'commercial' | 'vacation_rental' | 'multi_unit'
  address: {
    street: string
    city: string
    island: string
  }
}
