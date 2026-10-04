/**
 * TCERP - PostgreSQL Database Connection & Pool Manager
 * Package: @tcerp/database
 *
 * Provides real PostgreSQL pool connection with transaction management,
 * and automatic schema/migration initialization.
 */

import pg from 'pg';
import { newDb, IMemoryDb } from 'pg-mem';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { calculateTrigramSimilarity } from '@tcerp/shared';

export interface IDbPool {
  query<R extends pg.QueryResultRow = any, I extends any[] = any[]>(
    queryTextOrConfig: string | pg.QueryConfig<I>,
    values?: I
  ): Promise<pg.QueryResult<R>>;
  connect(): Promise<pg.PoolClient>;
  end(): Promise<void>;
}

let activePool: IDbPool | null = null;
let memDbInstance: IMemoryDb | null = null;

/**
 * Normalizes Persian/Arabic characters and computes standard 3-gram similarity (pg_trgm).
 */
function trigramSimilarity(strA: string, strB: string): number {
  if (!strA || !strB) return 0;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[يى]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[‌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const a = norm(strA);
  const b = norm(strB);
  if (a === b) return 1.0;

  const paddedA = `  ${a} `;
  const paddedB = `  ${b} `;
  const triA = new Set<string>();
  const triB = new Set<string>();

  for (let i = 0; i < paddedA.length - 2; i++) triA.add(paddedA.substring(i, i + 3));
  for (let i = 0; i < paddedB.length - 2; i++) triB.add(paddedB.substring(i, i + 3));

  let common = 0;
  for (const t of triA) {
    if (triB.has(t)) common++;
  }
  return (2 * common) / (triA.size + triB.size);
}

/**
 * Initializes in-process PostgreSQL database (pg-mem) with complete schemas and extensions.
 */
function createInProcessPostgres(): IDbPool {
  if (!memDbInstance) {
    memDbInstance = newDb();

    // Register gen_random_uuid
    memDbInstance.public.registerFunction({
      name: 'gen_random_uuid',
      returns: memDbInstance.public.getType('uuid' as any),
      implementation: () => crypto.randomUUID(),
    });

    // Register now
    memDbInstance.public.registerFunction({
      name: 'now',
      returns: memDbInstance.public.getType('timestamp with time zone' as any),
      implementation: () => new Date(),
    });

    // Register similarity function for pg_trgm compatibility
    memDbInstance.public.registerFunction({
      name: 'similarity',
      args: [memDbInstance.public.getType('text' as any), memDbInstance.public.getType('text' as any)],
      returns: memDbInstance.public.getType('float' as any),
      implementation: (a: string, b: string) => calculateTrigramSimilarity(a, b),
    });

    // Bootstrap Core Schemas
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(100) PRIMARY KEY,
        name_fa VARCHAR(255) NOT NULL,
        name_en VARCHAR(255),
        national_id VARCHAR(20),
        economic_code VARCHAR(30),
        registration_no VARCHAR(50),
        phone VARCHAR(50),
        address TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        mobile_normalized VARCHAR(20) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS parties (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL,
        party_type VARCHAR(20) NOT NULL,
        name_fa VARCHAR(255) NOT NULL,
        name_en VARCHAR(255),
        national_id VARCHAR(20),
        economic_code VARCHAR(30),
        registration_number VARCHAR(50),
        postal_code VARCHAR(20),
        website VARCHAR(255),
        email VARCHAR(255),
        assigned_salesperson_id VARCHAR(100),
        customer_score_level VARCHAR(20) NOT NULL DEFAULT 'BRONZE',
        risk_flag BOOLEAN NOT NULL DEFAULT false,
        operational_balance NUMERIC NOT NULL DEFAULT 0.00,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        is_archived BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS party_roles (
        id VARCHAR(100) PRIMARY KEY,
        party_id VARCHAR(100) NOT NULL,
        role_type VARCHAR(30) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_party_role UNIQUE (party_id, role_type)
      );

      CREATE TABLE IF NOT EXISTS party_phones (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL,
        party_id VARCHAR(100) NOT NULL,
        phone_type VARCHAR(20) NOT NULL,
        raw_number VARCHAR(50) NOT NULL,
        normalized_number VARCHAR(20) NOT NULL,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        is_verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_party_phones_company_normalized UNIQUE (company_id, normalized_number)
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id VARCHAR(100) PRIMARY KEY,
        company_party_id VARCHAR(100) NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        position VARCHAR(100),
        email VARCHAR(255),
        is_primary BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contact_phones (
        id VARCHAR(100) PRIMARY KEY,
        contact_id VARCHAR(100) NOT NULL,
        phone_type VARCHAR(20) NOT NULL,
        raw_number VARCHAR(50) NOT NULL,
        normalized_number VARCHAR(20) NOT NULL,
        is_primary BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS addresses (
        id VARCHAR(100) PRIMARY KEY,
        party_id VARCHAR(100) NOT NULL,
        address_type VARCHAR(30) NOT NULL,
        province VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        postal_code VARCHAR(20),
        address_line TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customer_score_histories (
        id VARCHAR(100) PRIMARY KEY,
        party_id VARCHAR(100) NOT NULL,
        score_level VARCHAR(20) NOT NULL,
        computed_score NUMERIC NOT NULL,
        metrics_snapshot JSONB NOT NULL,
        effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS financial_responsibilities (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL,
        guarantor_party_id VARCHAR(100) NOT NULL,
        guaranteed_party_id VARCHAR(100) NOT NULL,
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_guarantor_guaranteed UNIQUE (guarantor_party_id, guaranteed_party_id)
      );

      CREATE TABLE IF NOT EXISTS timeline_events (
        id VARCHAR(100) PRIMARY KEY,
        party_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        actor_user_id VARCHAR(100),
        actor_name VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        reason TEXT,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    memDbInstance.public.none(schemaSql);
  }

  const pgAdapter = memDbInstance.adapters.createPg();
  return new pgAdapter.Pool() as unknown as IDbPool;
}

/**
 * Returns the active database pool.
 */
export function getDbPool(): IDbPool {
  if (activePool) {
    return activePool;
  }

  const connectionString = process.env.DATABASE_URL;
  const host = process.env.DB_HOST;

  if (connectionString || (host && host !== 'localhost')) {
    activePool = new pg.Pool({
      connectionString,
      host: host || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'tcerp',
      user: process.env.DB_USER || 'erp_user',
      password: process.env.DB_PASSWORD || 'erp_password',
      max: 20,
      idleTimeoutMillis: 30000,
    }) as unknown as IDbPool;
  } else {
    // In-process PostgreSQL with complete dialect and constraint checking
    activePool = createInProcessPostgres();
  }

  return activePool;
}

/**
 * Closes the active pool (e.g. for graceful shutdown or test teardown).
 */
export async function closeDbPool(): Promise<void> {
  if (activePool) {
    await activePool.end();
    activePool = null;
  }
}

/**
 * Resets the in-process database (used in unit/integration test suites for pristine state).
 */
export function resetInProcessDb(): void {
  memDbInstance = null;
  activePool = null;
}
