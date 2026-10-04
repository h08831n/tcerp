/**
 * FooladERP - Core Foundation Types & Interfaces
 * Phase 1: IAM, Audit, Sequences, Settings, Files, Queues & Treasury Foundation
 */

export type RecordScope = 'OWN' | 'ASSIGNED' | 'TEAM' | 'ALL';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL';

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'OVERRIDE' 
  | 'POST' 
  | 'REVERSE' 
  | 'REJECT' 
  | 'APPROVE' 
  | 'EXPORT';

export type QueueJobPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type QueueJobStatus = 
  | 'PENDING' 
  | 'SCHEDULED' 
  | 'PROCESSING' 
  | 'SUCCEEDED' 
  | 'RETRYING' 
  | 'FAILED' 
  | 'CANCELLED';

export type ResetCycle = 'NEVER' | 'YEARLY_FISCAL' | 'YEARLY_CALENDAR' | 'MONTHLY';

export type YearFormat = 'JALALI_4' | 'GREGORIAN_4' | 'NONE';

export interface Company {
  id: string;
  code: string;
  name_fa: string;
  name_en?: string;
  national_id: string;
  economic_code?: string;
  registration_number?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  company_id: string;
  username: string;
  email: string;
  mobile_normalized: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  status: UserStatus;
  two_factor_enabled: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  company_id: string;
  code: string;
  name_fa: string;
  name_en?: string;
  description?: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  name_fa: string;
  description?: string;
  is_sensitive: boolean;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  record_scope: RecordScope;
  field_policy?: Record<string, 'HIDDEN' | 'READ_ONLY' | 'EDITABLE'>;
}

export interface Team {
  id: string;
  company_id: string;
  name: string;
  manager_user_id: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Delegation {
  id: string;
  company_id: string;
  from_user_id: string;
  to_user_id: string;
  scope: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  reason?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  diff?: Record<string, { old: unknown; new: unknown }>;
  reason?: string;
  created_at: string;
}

export interface Sequence {
  id: string;
  company_id: string;
  document_type: string;
  prefix: string;
  year_format: YearFormat;
  padding_digits: number;
  current_number: number;
  reset_cycle: ResetCycle;
  last_reset_date?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  company_id: string;
  section: string;
  setting_key: string;
  setting_value: unknown;
  is_encrypted: boolean;
  description?: string;
  updated_by?: string;
  updated_at: string;
}

export interface FileRecord {
  id: string;
  company_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  content_hash: string; // SHA-256
  storage_path: string;
  storage_bucket: string;
  created_by?: string;
  created_at: string;
}

export interface FileAttachment {
  id: string;
  company_id: string;
  file_id: string;
  entity_type: string;
  entity_id: string;
  category: string;
  is_sensitive: boolean;
  created_at: string;
}

export interface QueueJob {
  id: string;
  company_id: string;
  queue_name: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority: QueueJobPriority;
  status: QueueJobStatus;
  scheduled_at: string;
  attempt_count: number;
  max_attempts: number;
  is_dead_letter: boolean;
  last_error?: string;
  started_at?: string;
  finished_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Treasury & Accounting Foundation Types (Refinements 1, 2, 3)
export interface BankStatementLine {
  id: string;
  company_id: string;
  bank_account_id: string;
  entry_date: string; // YYYY-MM-DD
  sequence_no: number;
  transaction_type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  running_balance: number;
  reference_number?: string;
  description: string;
  source_entity_type: 'RECEIPT' | 'PAYMENT' | 'BANK_TRANSFER' | 'CHECK_CLEARING' | 'BANK_ADJUSTMENT';
  source_entity_id: string;
  journal_entry_id?: string;
  is_reconciled: boolean;
  reconciled_at?: string;
  created_at: string;
}

export interface BankTransfer {
  id: string;
  company_id: string;
  source_bank_account_id: string;
  destination_bank_account_id: string;
  transfer_amount: number;
  bank_fee: number;
  transfer_date: string;
  reference_number?: string;
  custom_description?: string;
  journal_entry_id?: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  created_by_user_id: string;
  created_at: string;
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  party_id?: string;
  debit: number;
  credit: number;
  description: string;
  line_order: number;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  fiscal_year_id: string;
  journal_id: string;
  entry_number: number;
  entry_date: string;
  document_type: string;
  overall_description: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED' | 'CANCELLED';
  lines: JournalLine[];
  created_at: string;
  created_by?: string;
  posted_at?: string;
  posted_by?: string;
}

export interface OperationalSettlementClaim {
  id: string;
  company_id: string;
  claim_direction: 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT';
  sales_document_id?: string;
  purchase_document_id?: string;
  party_id: string;
  claimed_amount: number;
  claim_date: string;
  payment_method: string;
  tracking_code?: string;
  receipt_file_id?: string;
  status: 'UNMATCHED' | 'MATCHED' | 'REJECTED';
  rejection_reason?: string;
  reconciled_statement_line_id?: string;
  created_by_user_id: string;
  reviewed_by_user_id?: string;
  reviewed_at?: string;
  created_at: string;
}
