-- ====================================================================
-- FOOLAD ERP - MIGRATION 002: MASTER DOMAIN SCHEMAS
-- Scope: CRM, Products, Sourcing, Sales, Procurement, Loading, Inventory,
--        Accounting Core, Treasury, Tax, Workflow, Automation, Import/Export
-- ====================================================================

-- 1. Parties, Phones, Contacts & Addresses
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('PERSON', 'COMPANY')),
    name_fa VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    national_id VARCHAR(20),
    economic_code VARCHAR(30),
    registration_number VARCHAR(50),
    postal_code VARCHAR(20),
    website VARCHAR(255),
    email VARCHAR(255),
    assigned_salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_score_level VARCHAR(20) NOT NULL DEFAULT 'BRONZE' CHECK (customer_score_level IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'VIP')),
    risk_flag BOOLEAN NOT NULL DEFAULT false,
    operational_balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00, -- Positive: Customer debt / Negative: Customer prepaid
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_party_company_name ON parties (company_id, name_fa);
CREATE INDEX IF NOT EXISTS idx_party_national_id ON parties (company_id, national_id);

CREATE TABLE IF NOT EXISTS party_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    role_type VARCHAR(30) NOT NULL CHECK (role_type IN ('CUSTOMER', 'SUPPLIER', 'DRIVER', 'CARRIER', 'PARTNER')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_party_role UNIQUE (party_id, role_type)
);

CREATE TABLE IF NOT EXISTS party_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    phone_type VARCHAR(20) NOT NULL CHECK (phone_type IN ('MOBILE', 'WORK_PHONE', 'FAX', 'OTHER')),
    raw_number VARCHAR(50) NOT NULL,
    normalized_number VARCHAR(20) NOT NULL, -- Standard E.164 e.g. +989121234567
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_party_normalized_phone UNIQUE (company_id, normalized_number)
);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    position VARCHAR(100),
    email VARCHAR(255),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    phone_type VARCHAR(20) NOT NULL CHECK (phone_type IN ('MOBILE', 'DIRECT_WORK', 'INTERNAL')),
    raw_number VARCHAR(50) NOT NULL,
    normalized_number VARCHAR(20) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    address_type VARCHAR(30) NOT NULL CHECK (address_type IN ('MAIN', 'BILLING', 'SHIPPING', 'UNLOADING', 'OFFICE', 'WAREHOUSE', 'OTHER')),
    province VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    address_line TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_score_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    score_level VARCHAR(20) NOT NULL,
    computed_score DECIMAL(10, 2) NOT NULL,
    metrics_snapshot JSONB NOT NULL,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_responsibilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    guarantor_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    guaranteed_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_guarantor_guaranteed UNIQUE (guarantor_party_id, guaranteed_party_id),
    CONSTRAINT chk_diff_guarantor CHECK (guarantor_party_id <> guaranteed_party_id)
);

CREATE TABLE IF NOT EXISTS portal_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    website_user_id VARCHAR(100) NOT NULL,
    verified_mobile VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_portal_party UNIQUE (company_id, party_id),
    CONSTRAINT uq_portal_website_user UNIQUE (company_id, website_user_id)
);

-- 2. Catalog & Products
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name_fa VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name_fa VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    code VARCHAR(50) NOT NULL,
    logo_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    CONSTRAINT uq_brand_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS uom_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS uoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES uom_categories(id) ON DELETE RESTRICT,
    name_fa VARCHAR(50) NOT NULL,
    name_en VARCHAR(50),
    symbol VARCHAR(20) NOT NULL,
    conversion_ratio DECIMAL(18, 6) NOT NULL, -- e.g. 1000 for TON to KG base
    is_base_unit BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS product_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    name_fa VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    internal_code VARCHAR(50) NOT NULL,
    is_sellable BOOLEAN NOT NULL DEFAULT true,
    is_purchasable BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prod_template_code UNIQUE (company_id, internal_code)
);

CREATE TABLE IF NOT EXISTS attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name_fa VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    CONSTRAINT uq_attribute_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS attribute_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    value_fa VARCHAR(100) NOT NULL,
    value_en VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_template_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE RESTRICT,
    sku VARCHAR(100) NOT NULL,
    name_fa VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    weight_per_unit DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
    default_uom_id UUID NOT NULL REFERENCES uoms(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prod_variant_sku UNIQUE (product_template_id, sku)
);

CREATE TABLE IF NOT EXISTS variant_attribute_values (
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE RESTRICT,
    PRIMARY KEY (variant_id, attribute_value_id)
);

-- Refinement 8: Strict check constraint for SupplierProduct Mapping
CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    mapping_level VARCHAR(20) NOT NULL CHECK (mapping_level IN ('VARIANT', 'TEMPLATE', 'CATEGORY')),
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    product_template_id UUID REFERENCES product_templates(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    supplier_product_code VARCHAR(100),
    supplier_product_name VARCHAR(255),
    last_offered_price DECIMAL(18, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_supplier_product_exact_one CHECK (
        (mapping_level = 'VARIANT' AND product_variant_id IS NOT NULL AND product_template_id IS NULL AND category_id IS NULL) OR
        (mapping_level = 'TEMPLATE' AND product_template_id IS NOT NULL AND product_variant_id IS NULL AND category_id IS NULL) OR
        (mapping_level = 'CATEGORY' AND category_id IS NOT NULL AND product_variant_id IS NULL AND product_template_id IS NULL)
    )
);

-- 3. Pricing & Multi-Channel Publishing
CREATE TABLE IF NOT EXISTS daily_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    price_date DATE NOT NULL,
    price DECIMAL(18, 2) NOT NULL,
    effective_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    price_source VARCHAR(100),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_daily_price UNIQUE (company_id, product_variant_id, price_date)
);

-- Refinement 3: Multi-channel Price Publishing Batch + Independent Channel Jobs
CREATE TABLE IF NOT EXISTS price_publish_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    batch_code VARCHAR(50) NOT NULL,
    publish_date DATE NOT NULL,
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_publish_channel_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES price_publish_batches(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL CHECK (channel IN ('TELEGRAM', 'BALE', 'EITAA', 'RUBIKA', 'WHATSAPP', 'WEBSITE')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    payload_snapshot JSONB NOT NULL,
    error_message TEXT,
    published_at TIMESTAMPTZ,
    CONSTRAINT uq_batch_channel UNIQUE (batch_id, channel)
);

-- 4. Sourcing & Price Requests
CREATE TABLE IF NOT EXISTS price_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OFFERS_COLLECTED', 'EXPIRED', 'CONVERTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_request_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_request_id UUID NOT NULL REFERENCES price_requests(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    requested_quantity DECIMAL(14, 3) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uoms(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS supplier_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_request_line_id UUID NOT NULL REFERENCES price_request_lines(id) ON DELETE CASCADE,
    supplier_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    offered_price DECIMAL(18, 2) NOT NULL,
    payment_terms VARCHAR(100),
    delivery_location VARCHAR(100),
    is_daily_lowest BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Sales & Procurement
CREATE TABLE IF NOT EXISTS sales_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE RESTRICT,
    document_number VARCHAR(50) NOT NULL, -- Identical across Quotation and Sales Order
    customer_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    salesperson_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    payment_term VARCHAR(100),
    shipping_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'QUOTATION' CHECK (status IN ('DRAFT', 'QUOTATION', 'CUSTOMER_CONFIRMED', 'SALES_ORDER', 'PARTIALLY_LOADED', 'COMPLETED', 'CANCELLED', 'LOST')),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    override_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    override_at TIMESTAMPTZ,
    lost_reason VARCHAR(100),
    total_operational_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_doc_number UNIQUE (company_id, sequence_id, document_number)
);

CREATE TABLE IF NOT EXISTS sales_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_document_id UUID NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    printable_description TEXT NOT NULL,
    ordered_quantity DECIMAL(14, 3) NOT NULL,
    loaded_quantity DECIMAL(14, 3) NOT NULL DEFAULT 0.000,
    uom_id UUID NOT NULL REFERENCES uoms(id) ON DELETE RESTRICT,
    unit_price DECIMAL(18, 2) NOT NULL,
    discount_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(18, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE RESTRICT,
    document_number VARCHAR(50) NOT NULL,
    supplier_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ORDER_PLACED', 'PARTIALLY_LOADED', 'COMPLETED', 'CANCELLED')),
    total_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_purchase_doc_number UNIQUE (company_id, sequence_id, document_number)
);

CREATE TABLE IF NOT EXISTS purchase_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_document_id UUID NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    ordered_quantity DECIMAL(14, 3) NOT NULL,
    loaded_quantity DECIMAL(14, 3) NOT NULL DEFAULT 0.000,
    uom_id UUID NOT NULL REFERENCES uoms(id) ON DELETE RESTRICT,
    unit_price DECIMAL(18, 2) NOT NULL,
    line_total DECIMAL(18, 2) NOT NULL
);

-- M:N Sales Line to Purchase Line Allocation with allocated_quantity
CREATE TABLE IF NOT EXISTS sales_purchase_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_line_id UUID NOT NULL REFERENCES sales_lines(id) ON DELETE CASCADE,
    purchase_line_id UUID NOT NULL REFERENCES purchase_lines(id) ON DELETE CASCADE,
    allocated_quantity DECIMAL(14, 3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_positive_sales_purchase_alloc CHECK (allocated_quantity > 0)
);

-- 6. Loading & Logistics (Refinement 5: Explicit LoadingLine + Allocation)
CREATE TABLE IF NOT EXISTS loadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    loading_date DATE NOT NULL DEFAULT CURRENT_DATE,
    driver_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    carrier_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    bill_of_lading_number VARCHAR(100),
    weighbridge_slip_number VARCHAR(100),
    weighbridge_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    driver_info_approved BOOLEAN NOT NULL DEFAULT false, -- Gatekeeper: Driver phone hidden for debtors until manager approval
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS loading_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loading_id UUID NOT NULL REFERENCES loadings(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    actual_quantity DECIMAL(14, 3) NOT NULL, -- Net actual weighbridge weight
    uom_id UUID NOT NULL REFERENCES uoms(id) ON DELETE RESTRICT,
    notes VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS loading_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loading_line_id UUID NOT NULL REFERENCES loading_lines(id) ON DELETE CASCADE,
    sales_line_id UUID REFERENCES sales_lines(id) ON DELETE SET NULL,
    purchase_line_id UUID REFERENCES purchase_lines(id) ON DELETE SET NULL,
    allocated_quantity DECIMAL(14, 3) NOT NULL,
    CONSTRAINT chk_loading_alloc_target CHECK (sales_line_id IS NOT NULL OR purchase_line_id IS NOT NULL)
);

-- 7. Warehouses & Automatic Stock Movement
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_warehouse_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    source_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    dest_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    quantity DECIMAL(14, 3) NOT NULL,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('SUPPLIER_TO_CUSTOMER', 'SUPPLIER_TO_WAREHOUSE', 'WAREHOUSE_TO_CUSTOMER', 'ADJUSTMENT')),
    loading_id UUID REFERENCES loadings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tax Invoices & Moadian Integration (Refinements 6: Tax snapshots & 2 clean allocation tables)
CREATE TABLE IF NOT EXISTS tax_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    tax_name VARCHAR(100) NOT NULL,
    rate_percent DECIMAL(5, 2) NOT NULL,
    is_locked_after_use BOOLEAN NOT NULL DEFAULT false,
    effective_from DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS tax_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    tax_item_code VARCHAR(30) NOT NULL, -- 13 digit official Moadian code
    unit_code VARCHAR(10) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_tax_product_code UNIQUE (company_id, tax_item_code)
);

CREATE TABLE IF NOT EXISTS sales_tax_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    tax_number VARCHAR(50), -- 22-digit Moadian unique tax ID
    buyer_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_pattern INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'QUEUED', 'SUBMITTED', 'SUCCESS', 'FAILED', 'CANCELLED')),
    total_before_tax DECIMAL(18, 2) NOT NULL,
    total_vat DECIMAL(18, 2) NOT NULL,
    total_amount DECIMAL(18, 2) NOT NULL,
    original_invoice_id UUID REFERENCES sales_tax_invoices(id) ON DELETE SET NULL,
    invoice_type VARCHAR(30) NOT NULL DEFAULT 'MAIN' CHECK (invoice_type IN ('MAIN', 'CORRECTIVE', 'CANCELLATION', 'RETURN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_tax_inv_number UNIQUE (company_id, sequence_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS sales_tax_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_tax_invoice_id UUID NOT NULL REFERENCES sales_tax_invoices(id) ON DELETE CASCADE,
    tax_product_id UUID NOT NULL REFERENCES tax_products(id) ON DELETE RESTRICT,
    tax_definition_id UUID NOT NULL REFERENCES tax_definitions(id) ON DELETE RESTRICT,
    tax_rate_snapshot DECIMAL(5, 2) NOT NULL, -- Historical snapshot
    quantity DECIMAL(14, 3) NOT NULL,
    unit_price DECIMAL(18, 2) NOT NULL,
    vat_amount DECIMAL(18, 2) NOT NULL,
    total_line DECIMAL(18, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_tax_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    seller_party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    tax_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    total_before_tax DECIMAL(18, 2) NOT NULL,
    total_vat DECIMAL(18, 2) NOT NULL,
    total_amount DECIMAL(18, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'RECONCILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_tax_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_tax_invoice_id UUID NOT NULL REFERENCES purchase_tax_invoices(id) ON DELETE CASCADE,
    tax_product_id UUID NOT NULL REFERENCES tax_products(id) ON DELETE RESTRICT,
    tax_definition_id UUID NOT NULL REFERENCES tax_definitions(id) ON DELETE RESTRICT,
    tax_rate_snapshot DECIMAL(5, 2) NOT NULL,
    quantity DECIMAL(14, 3) NOT NULL,
    unit_price DECIMAL(18, 2) NOT NULL,
    vat_amount DECIMAL(18, 2) NOT NULL,
    total_line DECIMAL(18, 2) NOT NULL
);

-- Refinement 6: Two separate, clean allocation tables
CREATE TABLE IF NOT EXISTS sales_tax_invoice_order_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_document_id UUID NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
    sales_tax_invoice_id UUID NOT NULL REFERENCES sales_tax_invoices(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(18, 2) NOT NULL,
    allocated_quantity DECIMAL(14, 3),
    CONSTRAINT uq_sales_tax_order_alloc UNIQUE (sales_document_id, sales_tax_invoice_id)
);

CREATE TABLE IF NOT EXISTS purchase_tax_invoice_order_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_document_id UUID NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE,
    purchase_tax_invoice_id UUID NOT NULL REFERENCES purchase_tax_invoices(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(18, 2) NOT NULL,
    allocated_quantity DECIMAL(14, 3),
    CONSTRAINT uq_purchase_tax_order_alloc UNIQUE (purchase_document_id, purchase_tax_invoice_id)
);

CREATE TABLE IF NOT EXISTS moadian_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_tax_invoice_id UUID NOT NULL REFERENCES sales_tax_invoices(id) ON DELETE CASCADE,
    attempt_no INTEGER NOT NULL,
    uid VARCHAR(100),
    reference_number VARCHAR(100),
    request_payload JSONB,
    response_payload JSONB,
    status VARCHAR(30) NOT NULL CHECK (status IN ('QUEUED', 'SENDING', 'SUBMITTED', 'WAITING_RESULT', 'SUCCESS', 'FAILED')),
    error_code VARCHAR(100),
    error_message TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_moadian_invoice_attempt UNIQUE (sales_tax_invoice_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS moadian_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES moadian_submissions(id) ON DELETE CASCADE,
    inquiry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL,
    raw_response JSONB
);

CREATE TABLE IF NOT EXISTS moadian_incoming_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    tax_number VARCHAR(50) NOT NULL,
    seller_economic_code VARCHAR(30) NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(18, 2) NOT NULL,
    vat_amount DECIMAL(18, 2) NOT NULL,
    match_status VARCHAR(30) NOT NULL DEFAULT 'UNMATCHED' CHECK (match_status IN ('UNMATCHED', 'MATCHED', 'MISMATCH', 'NEEDS_REVIEW')),
    buyer_reaction VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (buyer_reaction IN ('PENDING', 'APPROVED', 'REJECTED')),
    rejection_reason TEXT,
    matched_purchase_tax_invoice_id UUID REFERENCES purchase_tax_invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_moadian_incoming_tax_no UNIQUE (company_id, tax_number)
);

-- 9. Double-Entry Accounting Core
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL,
    name_fa VARCHAR(100) NOT NULL,
    level VARCHAR(20) NOT NULL CHECK (level IN ('GROUP', 'GENERAL', 'SUBSIDIARY', 'DETAIL')),
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    parent_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_account_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    CONSTRAINT uq_fiscal_year_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_journal_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE RESTRICT,
    journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
    entry_number INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('MANUAL', 'RECEIPT', 'PAYMENT', 'BANK_TRANSFER', 'TAX_INVOICE_SALES', 'TAX_INVOICE_PURCHASE', 'CHECK_CLEARING', 'OPENING', 'CLOSING')),
    overall_description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_journal_entry_no UNIQUE (company_id, fiscal_year_id, journal_id, entry_number)
);

-- Refinement 7: Journal lines with positive checks and mutual exclusion of debit/credit
CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
    debit DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    credit DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    description TEXT NOT NULL,
    line_order INTEGER NOT NULL,
    CONSTRAINT chk_journal_line_debit_credit CHECK (
        debit >= 0 AND credit >= 0 AND 
        (debit > 0 OR credit > 0) AND 
        NOT (debit > 0 AND credit > 0)
    )
);

CREATE TABLE IF NOT EXISTS description_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    title VARCHAR(100) NOT NULL,
    template_text TEXT NOT NULL,
    is_default_fee BOOLEAN NOT NULL DEFAULT false, -- For default 'کارمزد انتقال وجه'
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- 10. Treasury, Bank Ledger & Settlement Claims
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    sheba_number VARCHAR(50),
    card_number VARCHAR(30),
    gl_account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    initial_balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    current_balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_bank_account_no UNIQUE (company_id, account_number)
);

-- Refinement 1 & 2: BankStatementLine with strict unique (company, bank, date, sequence_no) and NO MANUAL_JOURNAL
CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    entry_date DATE NOT NULL,
    sequence_no INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL')),
    amount DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
    running_balance DECIMAL(18, 2) NOT NULL,
    reference_number VARCHAR(100),
    description TEXT NOT NULL,
    source_entity_type VARCHAR(30) NOT NULL CHECK (source_entity_type IN ('RECEIPT', 'PAYMENT', 'BANK_TRANSFER', 'CHECK_CLEARING', 'BANK_ADJUSTMENT')),
    source_entity_id UUID NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    is_reconciled BOOLEAN NOT NULL DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bank_statement_order UNIQUE (company_id, bank_account_id, entry_date, sequence_no)
);

-- Refinement 2: Symmetrical Operational Settlement Claims (Customer Receipt & Supplier Payment)
CREATE TABLE IF NOT EXISTS operational_settlement_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    claim_direction VARCHAR(30) NOT NULL CHECK (claim_direction IN ('CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT')),
    sales_document_id UUID REFERENCES sales_documents(id) ON DELETE SET NULL,
    purchase_document_id UUID REFERENCES purchase_documents(id) ON DELETE SET NULL,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    claimed_amount DECIMAL(18, 2) NOT NULL CHECK (claimed_amount > 0),
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) NOT NULL,
    tracking_code VARCHAR(100),
    receipt_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED' CHECK (status IN ('UNMATCHED', 'MATCHED', 'REJECTED')),
    rejection_reason TEXT, -- In case of rejection, operational balance effect is reverted immediately
    reconciled_statement_line_id UUID REFERENCES bank_statement_lines(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_claim_direction_relation CHECK (
        (claim_direction = 'CUSTOMER_RECEIPT' AND sales_document_id IS NOT NULL) OR
        (claim_direction = 'SUPPLIER_PAYMENT' AND purchase_document_id IS NOT NULL)
    )
);

-- Refinement 3: BankTransfer with posting enforcement (Dest X, Fee F, Source X+F)
CREATE TABLE IF NOT EXISTS bank_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    source_bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    destination_bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    transfer_amount DECIMAL(18, 2) NOT NULL CHECK (transfer_amount > 0),
    bank_fee DECIMAL(18, 2) NOT NULL DEFAULT 0.00 CHECK (bank_fee >= 0),
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100),
    description_template_id UUID REFERENCES description_templates(id) ON DELETE SET NULL,
    custom_description TEXT,
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED')),
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_diff_banks CHECK (source_bank_account_id <> destination_bank_account_id)
);

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    amount DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
    bank_fee DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    net_received DECIMAL(18, 2) NOT NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'POSTED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    amount DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
    bank_fee DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'POSTED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refinement 17: Checks with distinct incoming/outgoing status lifecycles
CREATE TABLE IF NOT EXISTS checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    check_direction VARCHAR(20) NOT NULL CHECK (check_direction IN ('INCOMING', 'OUTGOING')),
    sayad_id VARCHAR(20) NOT NULL,
    check_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    amount DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL,
    cleared_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_check_direction_status CHECK (
        (check_direction = 'INCOMING' AND status IN ('REGISTERED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED')) OR
        (check_direction = 'OUTGOING' AND status IN ('REGISTERED', 'DELIVERED', 'PAID', 'BOUNCED', 'CANCELLED'))
    )
);

-- 11. Activities & Workflow (Refinement 4: WorkflowTimer runtime entity)
CREATE TABLE IF NOT EXISTS activity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name_fa VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    related_entity_type VARCHAR(100) NOT NULL,
    related_entity_id UUID NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    scheduled_date TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'COMPLETED', 'CANCELLED')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    state_code VARCHAR(50) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    is_initial BOOLEAN NOT NULL DEFAULT false,
    is_final BOOLEAN NOT NULL DEFAULT false,
    field_locks JSONB,
    CONSTRAINT uq_workflow_state UNIQUE (workflow_id, state_code)
);

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    from_state_id UUID NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
    to_state_id UUID NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
    transition_name VARCHAR(100) NOT NULL,
    required_permission VARCHAR(100),
    conditions JSONB,
    require_approval BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    current_state_id UUID NOT NULL REFERENCES workflow_states(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workflow_execution UNIQUE (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS workflow_state_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    from_state_id UUID NOT NULL REFERENCES workflow_states(id) ON DELETE RESTRICT,
    to_state_id UUID NOT NULL REFERENCES workflow_states(id) ON DELETE RESTRICT,
    transition_id UUID REFERENCES workflow_transitions(id) ON DELETE SET NULL,
    performed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type VARCHAR(20) NOT NULL DEFAULT 'FORWARD' CHECK (action_type IN ('FORWARD', 'REOPEN', 'ROLLBACK')),
    reason TEXT,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refinement 4: WorkflowTimer runtime entity for SLA / timeout / escalation
CREATE TABLE IF NOT EXISTS workflow_timers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    current_state_id UUID NOT NULL REFERENCES workflow_states(id) ON DELETE RESTRICT,
    timer_name VARCHAR(100) NOT NULL,
    trigger_at TIMESTAMPTZ NOT NULL,
    escalation_action JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIGGERED', 'CANCELLED')),
    triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reason TEXT NOT NULL,
    decision_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approver_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    delegated_from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    decision_comment TEXT,
    decided_at TIMESTAMPTZ
);

-- 12. Automation & Notifications (Refinement 5: NotificationRule explicit structure)
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    condition_tree JSONB NOT NULL,
    delay_config JSONB,
    actions JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rule_version UNIQUE (rule_id, version)
);

CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES automation_rule_versions(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('PENDING', 'SCHEDULED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS automation_action_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_details TEXT
);

-- Refinement 5: NotificationRule with explicit fields
CREATE TABLE IF NOT EXISTS notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    event_name VARCHAR(100) NOT NULL,
    conditions JSONB,
    recipient_config JSONB NOT NULL, -- { type: 'SALESPERSON'|'OWNER'|'ROLE', target_role_id?: string }
    channels JSONB NOT NULL, -- ['IN_APP', 'SMS', 'EMAIL']
    delay_config JSONB, -- { delay_seconds: number }
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    deep_link_entity_type VARCHAR(100),
    deep_link_entity_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    body_template TEXT NOT NULL,
    template_code VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    recipient_phone VARCHAR(20) NOT NULL,
    template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED')),
    provider VARCHAR(50) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Resumable Chunked Import/Export (Refinement 7: UPDATE_MATCHED)
CREATE TABLE IF NOT EXISTS import_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    mapping_rules JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL,
    original_file_id UUID NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    mapping_id UUID NOT NULL REFERENCES import_mappings(id) ON DELETE RESTRICT,
    import_mode VARCHAR(30) NOT NULL CHECK (import_mode IN ('CREATE_ONLY', 'UPDATE_EXISTING', 'CREATE_AND_UPDATE')),
    match_key VARCHAR(30) NOT NULL CHECK (match_key IN ('MOBILE', 'NATIONAL_ID', 'INTERNAL_CODE', 'SKU')),
    duplicate_policy VARCHAR(30) NOT NULL DEFAULT 'UPDATE_MATCHED' CHECK (duplicate_policy IN ('SKIP', 'UPDATE_MATCHED', 'FLAG_FOR_REVIEW')),
    from_row INTEGER NOT NULL DEFAULT 1,
    to_row INTEGER,
    batch_size INTEGER NOT NULL DEFAULT 1000,
    checkpoint_last_row INTEGER NOT NULL DEFAULT 0,
    total_rows INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'MAPPED', 'VALIDATED', 'PROCESSING', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    failed_rows_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    batch_index INTEGER NOT NULL,
    start_row INTEGER NOT NULL,
    end_row INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
    error_summary TEXT,
    CONSTRAINT uq_import_job_batch UNIQUE (import_job_id, batch_index)
);

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL,
    filter_criteria JSONB,
    selected_columns JSONB NOT NULL,
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
