-- ====================================================================
-- TCERP - MIGRATION 003: PARTY & CRM CORE
-- Scope: Party, Multiple Normalized Phones, Contacts, Addresses,
--        Customer Scoring, Financial Responsibility & CRM Timeline
-- Package: @tcerp/database
-- ====================================================================

-- 1. Enable pg_trgm for Persian & English Name Similarity Queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Enhanced Trigram Index on Party Names for Similarity Matching (>= 85%)
CREATE INDEX IF NOT EXISTS idx_parties_name_fa_trgm ON parties USING gin (name_fa gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parties_name_en_trgm ON parties USING gin (name_en gin_trgm_ops);

-- 3. Dedicated Composite Indexes for Fast Search
CREATE INDEX IF NOT EXISTS idx_parties_company_status ON parties (company_id, status);
CREATE INDEX IF NOT EXISTS idx_parties_salesperson ON parties (company_id, assigned_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_parties_economic_code ON parties (company_id, economic_code);
CREATE INDEX IF NOT EXISTS idx_parties_reg_number ON parties (company_id, registration_number);

-- 4. Fast Normalized Phone Lookup Index
CREATE INDEX IF NOT EXISTS idx_party_phones_normalized ON party_phones (company_id, normalized_number);
CREATE INDEX IF NOT EXISTS idx_contact_phones_normalized ON contact_phones (normalized_number);

-- 5. CRM Unified Timeline Events Table
CREATE TABLE IF NOT EXISTS timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeline_events_party ON timeline_events (party_id, created_at DESC);
