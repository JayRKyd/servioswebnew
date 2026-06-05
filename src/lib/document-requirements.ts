export type DocType = 'government_id' | 'liability_insurance' | 'trade_cert' | 'professional_membership'

export interface CategoryGroupConfig {
  label: string
  requiredDocs: DocType[]
}

export const CATEGORY_GROUPS: Record<string, CategoryGroupConfig> = {
  trades_repairs: {
    label: 'Trades & Repairs',
    requiredDocs: ['government_id', 'liability_insurance', 'trade_cert'],
  },
  property_professionals: {
    label: 'Property Professionals',
    requiredDocs: ['government_id', 'professional_membership'],
  },
  cleaning: {
    label: 'Cleaning Services',
    requiredDocs: ['government_id', 'liability_insurance'],
  },
  automotive: {
    label: 'Automotive & Mobile Vehicle Services',
    requiredDocs: ['government_id', 'liability_insurance'],
  },
  specialist: {
    label: 'Specialist Restoration & Craft',
    requiredDocs: ['government_id', 'liability_insurance'],
  },
}

export const BADGE_LABELS: Record<string, string> = {
  government_id: 'ID Verified',
  liability_insurance: 'Insurance Verified',
  trade_cert: 'Trade Cert',
  professional_membership: 'Professional Member',
}

/** Returns the display label for a document type. */
export function docTypeLabel(type: string): string {
  const map: Record<string, string> = {
    government_id: 'Government ID',
    liability_insurance: 'Liability Insurance',
    trade_cert: 'Trade Certification',
    professional_membership: 'Professional Membership',
    insurance: 'Insurance',
    license: 'Licence',
    certification: 'Certification',
    id: 'Identity Document',
    contract: 'Contract',
    other: 'Other',
  }
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
