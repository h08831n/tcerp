/**
 * TCERP - Party & CRM Core Domain Types
 * Package: @tcerp/domain
 */

export type PartyType = 'PERSON' | 'COMPANY';

export type PartyRoleType = 'CUSTOMER' | 'SUPPLIER' | 'DRIVER' | 'CARRIER' | 'PARTNER';

export type PhoneType = 'MOBILE' | 'WORK_PHONE' | 'FAX' | 'OTHER';

export type ContactPhoneType = 'MOBILE' | 'DIRECT_WORK' | 'INTERNAL';

export type AddressType = 'MAIN' | 'BILLING' | 'SHIPPING' | 'UNLOADING' | 'OFFICE' | 'WAREHOUSE' | 'OTHER';

export type CustomerScoreLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP';

export type PartyStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'ARCHIVED';

export interface Party {
  id: string;
  company_id: string;
  party_type: PartyType;
  name_fa: string;
  name_en?: string;
  national_id?: string;
  economic_code?: string;
  registration_number?: string;
  postal_code?: string;
  website?: string;
  email?: string;
  assigned_salesperson_id?: string;
  customer_score_level: CustomerScoreLevel;
  risk_flag: boolean;
  operational_balance: number; // Positive: Customer debt / Negative: Prepaid
  status: PartyStatus;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface PartyRole {
  id: string;
  party_id: string;
  role_type: PartyRoleType;
  is_active: boolean;
  created_at: string;
}

export interface PartyPhone {
  id: string;
  company_id: string;
  party_id: string;
  phone_type: PhoneType;
  raw_number: string;
  normalized_number: string; // Canonical E.164 e.g. +989121234567
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  company_party_id: string;
  full_name: string;
  position?: string;
  email?: string;
  is_primary: boolean;
  created_at: string;
}

export interface ContactPhone {
  id: string;
  contact_id: string;
  phone_type: ContactPhoneType;
  raw_number: string;
  normalized_number: string;
  is_primary: boolean;
}

export interface Address {
  id: string;
  party_id: string;
  address_type: AddressType;
  province: string;
  city: string;
  postal_code?: string;
  address_line: string;
  is_default: boolean;
  created_at: string;
}

export interface CustomerScoreHistory {
  id: string;
  party_id: string;
  score_level: CustomerScoreLevel;
  computed_score: number;
  metrics_snapshot: {
    operational_profit: number;
    purchased_tonnage: number;
    purchase_count: number;
    total_paid: number;
    recency_days: number;
  };
  effective_date: string;
}

export interface CustomerScoringConfig {
  profitWeight: number;
  tonnageWeight: number;
  frequencyWeight: number;
  levels: {
    VIP: number;
    PLATINUM: number;
    GOLD: number;
    SILVER: number;
    BRONZE: number;
  };
}

export interface FinancialResponsibility {
  id: string;
  company_id: string;
  guarantor_party_id: string; // Responsible payer (e.g. Mr. Ravan)
  guaranteed_party_id: string; // Sub-account / entity
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface ConsolidatedResponsibilityReport {
  guarantor: Party;
  guaranteedParties: Array<{
    party: Party;
    individualDebt: number;
  }>;
  totalConsolidatedDebt: number;
}

export interface TimelineEvent {
  id: string;
  party_id: string;
  event_type: 
    | 'PARTY_CREATED'
    | 'NOTE_ADDED'
    | 'CONTACT_ADDED'
    | 'ROLE_CHANGED'
    | 'OWNER_CHANGED'
    | 'PHONE_ADDED'
    | 'ADDRESS_ADDED'
    | 'SCORE_UPDATED'
    | 'FINANCIAL_RESPONSIBILITY_LINKED'
    | 'CLAIM_SUBMITTED'
    | 'CLAIM_REJECTED';
  title: string;
  description?: string;
  actor_user_id?: string;
  actor_name?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface DuplicateCheckResult {
  exactDuplicateMobile?: {
    party: Party;
    phone: PartyPhone;
    ownerSalespersonName?: string;
    hasAccessToOwner: boolean;
  };
  possibleDuplicates: Array<{
    party: Party;
    similarityScore: number;
  }>;
}
