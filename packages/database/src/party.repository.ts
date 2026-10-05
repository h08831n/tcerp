/**
 * TCERP - Party & CRM PostgreSQL Persistence Repository
 * Package: @tcerp/database
 *
 * Implements real PostgreSQL queries, atomic transaction management,
 * database-level unique constraint enforcement, and pg_trgm similarity.
 */

import {
  Address,
  AddressType,
  ConsolidatedResponsibilityReport,
  Contact,
  ContactPhone,
  CustomerScoreHistory,
  CustomerScoreLevel,
  FinancialResponsibility,
  Party,
  PartyPhone,
  PartyRole,
  PartyRoleType,
  PartyType,
  PhoneType,
  TimelineEvent,
} from '@tcerp/domain';
import { getDbPool, IDbPool } from './postgres';
import crypto from 'crypto';

export class DuplicatePhoneError extends Error {
  public readonly code = 'DUPLICATE_PHONE';
  constructor(public readonly phoneNumber: string, message?: string) {
    super(message || `شماره تماس ${phoneNumber} پیش‌تر در سامانه برای طرف‌حساب دیگری ثبت شده است.`);
    this.name = 'DuplicatePhoneError';
  }
}

export interface PartyDetail extends Party {
  roles: PartyRole[];
  phones: PartyPhone[];
  contacts: Array<Contact & { phones: ContactPhone[] }>;
  addresses: Address[];
  scoreHistory?: CustomerScoreHistory[];
  guarantorFor?: Party[];
  guaranteedBy?: Party[];
}

export interface IPartyRepository {
  findPartyById(id: string): Promise<PartyDetail | null>;
  listParties(options: {
    companyId: string;
    role?: PartyRoleType;
    status?: string;
    assignedSalespersonId?: string;
    teamSalespersonIds?: string[];
    query?: string;
    page?: number;
    limit?: number;
    includeArchived?: boolean;
  }): Promise<{ parties: PartyDetail[]; total: number }>;
  checkDuplicatePhones(companyId: string, normalizedPhones: string[]): Promise<string[]>;
  findSimilarNames(companyId: string, nameFa: string, threshold?: number): Promise<Array<{ party: Party; similarity: number }>>;
  createPartyWithDetails(data: {
    party: Omit<Party, 'id' | 'created_at' | 'updated_at'>;
    roles: PartyRoleType[];
    phones: Array<Omit<PartyPhone, 'id' | 'party_id' | 'created_at'>>;
    addresses?: Array<Omit<Address, 'id' | 'party_id' | 'created_at'>>;
    contacts?: Array<{
      contact: Omit<Contact, 'id' | 'company_party_id' | 'created_at'>;
      phones: Array<Omit<ContactPhone, 'id' | 'contact_id'>>;
    }>;
  }): Promise<PartyDetail>;
  updateParty(id: string, updates: Partial<Party>): Promise<Party>;
  assignSalesperson(partyId: string, salespersonId: string | null): Promise<void>;
  addPartyPhone(phone: Omit<PartyPhone, 'id' | 'created_at'>): Promise<PartyPhone>;
  addContact(
    contact: Omit<Contact, 'id' | 'created_at'>,
    phones: Array<Omit<ContactPhone, 'id' | 'contact_id'>>
  ): Promise<Contact & { phones: ContactPhone[] }>;
  addAddress(address: Omit<Address, 'id' | 'created_at'>): Promise<Address>;
  linkFinancialResponsibility(
    companyId: string,
    guarantorPartyId: string,
    guaranteedPartyId: string,
    notes?: string
  ): Promise<FinancialResponsibility>;
  getFinancialResponsibilityReport(guarantorPartyId: string): Promise<ConsolidatedResponsibilityReport>;
  recordScoreHistory(history: Omit<CustomerScoreHistory, 'id'>): Promise<CustomerScoreHistory>;
  addTimelineEvent(event: Omit<TimelineEvent, 'id' | 'created_at'>): Promise<TimelineEvent>;
  getTimelineEvents(partyId: string): Promise<TimelineEvent[]>;
  archiveParty(partyId: string): Promise<void>;
}

export class PostgresPartyRepository implements IPartyRepository {
  private pool: IDbPool;

  constructor(customPool?: IDbPool) {
    this.pool = customPool || getDbPool();
  }

  private mapPartyRow(row: any): Party {
    return {
      id: row.id,
      company_id: row.company_id,
      party_type: row.party_type as PartyType,
      name_fa: row.name_fa,
      name_en: row.name_en || undefined,
      national_id: row.national_id || undefined,
      economic_code: row.economic_code || undefined,
      registration_number: row.registration_number || undefined,
      postal_code: row.postal_code || undefined,
      website: row.website || undefined,
      email: row.email || undefined,
      assigned_salesperson_id: row.assigned_salesperson_id || undefined,
      customer_score_level: (row.customer_score_level as CustomerScoreLevel) || 'BRONZE',
      risk_flag: Boolean(row.risk_flag),
      operational_balance: Number(row.operational_balance || 0),
      status: row.status,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  public async findByNormalizedPhone(
    companyId: string,
    normalizedPhone: string
  ): Promise<{ party: Party; phone: PartyPhone } | null> {
    const res = await this.pool.query(
      `SELECT p.*, ph.id as ph_id, ph.raw_number, ph.normalized_number, ph.phone_type, ph.is_primary, ph.is_verified, ph.created_at as ph_created_at
       FROM party_phones ph
       JOIN parties p ON ph.party_id = p.id
       WHERE ph.company_id = $1 AND ph.normalized_number = $2
       LIMIT 1`,
      [companyId, normalizedPhone]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      party: this.mapPartyRow(row),
      phone: {
        id: row.ph_id,
        company_id: companyId,
        party_id: row.id,
        phone_type: row.phone_type as PhoneType,
        raw_number: row.raw_number,
        normalized_number: row.normalized_number,
        is_primary: Boolean(row.is_primary),
        is_verified: Boolean(row.is_verified),
        created_at: new Date(row.ph_created_at).toISOString(),
      },
    };
  }

  public async findParties(options: {
    companyId: string;
    role?: PartyRoleType;
    status?: string;
    salespersonId?: string;
    teamSalespersonIds?: string[];
    query?: string;
    page?: number;
    limit?: number;
    includeArchived?: boolean;
  }): Promise<{ items: PartyDetail[]; total: number }> {
    const { parties, total } = await this.listParties({
      ...options,
      assignedSalespersonId: options.salespersonId,
    });
    return { items: parties, total };
  }

  public async createParty(
    party: Omit<Party, 'id' | 'created_at' | 'updated_at'>,
    roles: PartyRoleType[] = ['CUSTOMER'],
    phones: Array<Omit<PartyPhone, 'id' | 'party_id' | 'created_at'>> = []
  ): Promise<PartyDetail> {
    return this.createPartyWithDetails({
      party,
      roles,
      phones,
    });
  }

  public async addRole(partyId: string, roleType: PartyRoleType): Promise<PartyRole> {
    const id = crypto.randomUUID();
    const now = new Date();
    await this.pool.query(
      `INSERT INTO party_roles (id, party_id, role_type, is_active, created_at)
       VALUES ($1, $2, $3, true, $4)`,
      [id, partyId, roleType, now]
    );
    return {
      id,
      party_id: partyId,
      role_type: roleType,
      is_active: true,
      created_at: now.toISOString(),
    };
  }

  public async addPhone(phone: Omit<PartyPhone, 'id' | 'created_at'>): Promise<PartyPhone> {
    return this.addPartyPhone(phone);
  }

  public async findPartyById(id: string): Promise<PartyDetail | null> {
    const partyRes = await this.pool.query('SELECT * FROM parties WHERE id = $1', [id]);
    if (partyRes.rows.length === 0) return null;

    const party = this.mapPartyRow(partyRes.rows[0]);

    // Roles
    const rolesRes = await this.pool.query('SELECT * FROM party_roles WHERE party_id = $1 ORDER BY created_at ASC', [id]);
    const roles: PartyRole[] = rolesRes.rows.map(r => ({
      id: r.id,
      party_id: r.party_id,
      role_type: r.role_type as PartyRoleType,
      is_active: Boolean(r.is_active),
      created_at: new Date(r.created_at).toISOString(),
    }));

    // Phones
    const phonesRes = await this.pool.query(
      'SELECT * FROM party_phones WHERE party_id = $1 ORDER BY is_primary DESC, created_at ASC',
      [id]
    );
    const phones: PartyPhone[] = phonesRes.rows.map(ph => ({
      id: ph.id,
      company_id: ph.company_id,
      party_id: ph.party_id,
      phone_type: ph.phone_type as PhoneType,
      raw_number: ph.raw_number,
      normalized_number: ph.normalized_number,
      is_primary: Boolean(ph.is_primary),
      is_verified: Boolean(ph.is_verified),
      created_at: new Date(ph.created_at).toISOString(),
    }));

    // Contacts
    const contactsRes = await this.pool.query(
      'SELECT * FROM contacts WHERE company_party_id = $1 ORDER BY is_primary DESC, created_at ASC',
      [id]
    );
    const contacts: Array<Contact & { phones: ContactPhone[] }> = [];
    for (const c of contactsRes.rows) {
      const cPhonesRes = await this.pool.query('SELECT * FROM contact_phones WHERE contact_id = $1', [c.id]);
      contacts.push({
        id: c.id,
        company_party_id: c.company_party_id,
        full_name: c.full_name,
        position: c.position || undefined,
        email: c.email || undefined,
        is_primary: Boolean(c.is_primary),
        created_at: new Date(c.created_at).toISOString(),
        phones: cPhonesRes.rows.map(cp => ({
          id: cp.id,
          contact_id: cp.contact_id,
          phone_type: cp.phone_type,
          raw_number: cp.raw_number,
          normalized_number: cp.normalized_number,
          is_primary: Boolean(cp.is_primary),
        })),
      });
    }

    // Addresses
    const addressesRes = await this.pool.query('SELECT * FROM addresses WHERE party_id = $1 ORDER BY is_default DESC, created_at ASC', [id]);
    const addresses: Address[] = addressesRes.rows.map(ad => ({
      id: ad.id,
      party_id: ad.party_id,
      address_type: ad.address_type as AddressType,
      province: ad.province,
      city: ad.city,
      postal_code: ad.postal_code || undefined,
      address_line: ad.address_line,
      is_default: Boolean(ad.is_default),
      created_at: new Date(ad.created_at).toISOString(),
    }));

    // Score History
    const scoreRes = await this.pool.query(
      'SELECT * FROM customer_score_histories WHERE party_id = $1 ORDER BY effective_date DESC LIMIT 5',
      [id]
    );
    const scoreHistory: CustomerScoreHistory[] = scoreRes.rows.map(s => ({
      id: s.id,
      party_id: s.party_id,
      score_level: s.score_level,
      computed_score: Number(s.computed_score),
      metrics_snapshot: typeof s.metrics_snapshot === 'string' ? JSON.parse(s.metrics_snapshot) : s.metrics_snapshot,
      effective_date: new Date(s.effective_date).toISOString(),
    }));

    return {
      ...party,
      party,
      roles,
      phones,
      contacts,
      addresses,
      scoreHistory,
      timeline: [],
    } as any;
  }

  public async listParties(options: {
    companyId: string;
    role?: PartyRoleType;
    status?: string;
    assignedSalespersonId?: string;
    teamSalespersonIds?: string[];
    query?: string;
    page?: number;
    limit?: number;
    includeArchived?: boolean;
  }): Promise<{ parties: PartyDetail[]; total: number }> {
    const conditions: string[] = ['p.company_id = $1'];
    const params: any[] = [options.companyId];

    if (!options.includeArchived) {
      conditions.push("p.status <> 'ARCHIVED'");
      conditions.push('p.is_archived = false');
    }

    if (options.status) {
      params.push(options.status);
      conditions.push(`p.status = $${params.length}`);
    }

    if (options.assignedSalespersonId) {
      params.push(options.assignedSalespersonId);
      conditions.push(`p.assigned_salesperson_id = $${params.length}`);
    } else if (options.teamSalespersonIds && options.teamSalespersonIds.length > 0) {
      const placeholders = options.teamSalespersonIds.map(id => {
        params.push(id);
        return `$${params.length}`;
      }).join(', ');
      conditions.push(`p.assigned_salesperson_id IN (${placeholders})`);
    }

    if (options.role) {
      params.push(options.role);
      conditions.push(`p.id IN (
        SELECT pr.party_id FROM party_roles pr 
        WHERE pr.role_type = $${params.length} AND pr.is_active = true
      )`);
    }

    if (options.query) {
      const q = `%${options.query.trim()}%`;
      params.push(q);
      const qIdx = params.length;
      conditions.push(`(
        p.name_fa ILIKE $${qIdx} OR 
        p.name_en ILIKE $${qIdx} OR 
        p.national_id ILIKE $${qIdx} OR 
        p.economic_code ILIKE $${qIdx} OR
        p.id IN (
          SELECT ph.party_id FROM party_phones ph 
          WHERE ph.normalized_number ILIKE $${qIdx} OR ph.raw_number ILIKE $${qIdx}
        )
      )`);
    }

    const whereClause = conditions.join(' AND ');
    const countRes = await this.pool.query(`SELECT COUNT(*) as cnt FROM parties p WHERE ${whereClause}`, params);
    const total = Number(countRes.rows[0]?.cnt || 0);

    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 20);
    const offset = (page - 1) * limit;

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const partiesRes = await this.pool.query(
      `SELECT p.* FROM parties p WHERE ${whereClause} ORDER BY p.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const detailed: PartyDetail[] = [];
    const partyIds = partiesRes.rows.map((r: any) => r.id);

    // Fetch roles in batch (O(1) query complexity)
    const rolesMap = new Map<string, PartyRole[]>();
    // Fetch phones in batch (O(1) query complexity)
    const phonesMap = new Map<string, PartyPhone[]>();

    if (partyIds.length > 0) {
      const placeholders = partyIds.map((_, i) => `$${i + 1}`).join(', ');
      
      const rolesRes = await this.pool.query(
        `SELECT * FROM party_roles WHERE party_id IN (${placeholders}) AND is_active = true ORDER BY created_at ASC`,
        partyIds
      );
      for (const r of rolesRes.rows) {
        const list = rolesMap.get(r.party_id) || [];
        list.push({
          id: r.id,
          party_id: r.party_id,
          role_type: r.role_type as PartyRoleType,
          is_active: Boolean(r.is_active),
          created_at: new Date(r.created_at).toISOString(),
        });
        rolesMap.set(r.party_id, list);
      }

      const phonesRes = await this.pool.query(
        `SELECT * FROM party_phones WHERE party_id IN (${placeholders}) ORDER BY is_primary DESC, created_at ASC`,
        partyIds
      );
      for (const ph of phonesRes.rows) {
        const list = phonesMap.get(ph.party_id) || [];
        list.push({
          id: ph.id,
          company_id: ph.company_id,
          party_id: ph.party_id,
          phone_type: ph.phone_type as PhoneType,
          raw_number: ph.raw_number,
          normalized_number: ph.normalized_number,
          is_primary: Boolean(ph.is_primary),
          is_verified: Boolean(ph.is_verified),
          created_at: new Date(ph.created_at).toISOString(),
        });
        phonesMap.set(ph.party_id, list);
      }
    }

    for (const row of partiesRes.rows) {
      detailed.push({
        id: row.id,
        party: this.mapPartyRow(row),
        roles: rolesMap.get(row.id) || [],
        phones: phonesMap.get(row.id) || [],
        contacts: [],
        addresses: [],
        timeline: [],
        scoreHistory: [],
      } as any);
    }

    return { parties: detailed, total };
  }

  public async checkDuplicatePhones(companyId: string, normalizedPhones: string[]): Promise<string[]> {
    if (!normalizedPhones.length) return [];
    const placeholders = normalizedPhones.map((_, i) => `$${i + 2}`).join(', ');
    const res = await this.pool.query(
      `SELECT DISTINCT normalized_number FROM party_phones WHERE company_id = $1 AND normalized_number IN (${placeholders})`,
      [companyId, ...normalizedPhones]
    );
    return res.rows.map(r => r.normalized_number);
  }

  public async findSimilarNames(
    companyId: string,
    nameFa: string,
    excludePartyIdOrThreshold?: string | number,
    maybeThreshold?: number
  ): Promise<Array<{ party: Party; similarity: number }>> {
    let excludePartyId: string | undefined;
    let threshold = 0.85;

    if (typeof excludePartyIdOrThreshold === 'string') {
      excludePartyId = excludePartyIdOrThreshold;
      if (typeof maybeThreshold === 'number') threshold = maybeThreshold;
    } else if (typeof excludePartyIdOrThreshold === 'number') {
      threshold = excludePartyIdOrThreshold;
    }

    let sql = `SELECT p.*, similarity(p.name_fa, $1) as sim_score 
       FROM parties p 
       WHERE p.company_id = $2 AND similarity(p.name_fa, $1) >= $3`;
    const params: any[] = [nameFa, companyId, threshold];

    if (excludePartyId) {
      params.push(excludePartyId);
      sql += ` AND p.id <> $${params.length}`;
    }

    sql += ` ORDER BY sim_score DESC LIMIT 5`;

    const res = await this.pool.query(sql, params);

    return res.rows.map(r => ({
      party: this.mapPartyRow(r),
      similarity: Math.round(Number(r.sim_score) * 1000) / 1000,
    }));
  }

  /**
   * Atomic PostgreSQL Transaction for Party Creation:
   * 1. Insert Party
   * 2. Insert Initial Roles
   * 3. Insert Normalized Phones (unique constraint checked)
   * 4. Insert Addresses
   * 5. Insert Contacts & Contact Phones
   * All commit or all rollback atomically.
   */
  public async createPartyWithDetails(data: {
    party: Omit<Party, 'id' | 'created_at' | 'updated_at'>;
    roles: PartyRoleType[];
    phones: Array<Omit<PartyPhone, 'id' | 'party_id' | 'created_at'>>;
    addresses?: Array<Omit<Address, 'id' | 'party_id' | 'created_at'>>;
    contacts?: Array<{
      contact: Omit<Contact, 'id' | 'company_party_id' | 'created_at'>;
      phones: Array<Omit<ContactPhone, 'id' | 'contact_id'>>;
    }>;
  }): Promise<PartyDetail> {
    const client = await this.pool.connect();
    const partyId = crypto.randomUUID();
    const now = new Date();

    try {
      await client.query('BEGIN');

      // 1. Insert Party
      await client.query(
        `INSERT INTO parties (
          id, company_id, party_type, name_fa, name_en, national_id, economic_code,
          registration_number, postal_code, website, email, assigned_salesperson_id,
          customer_score_level, risk_flag, operational_balance, status, is_archived,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )`,
        [
          partyId,
          data.party.company_id,
          data.party.party_type,
          data.party.name_fa,
          data.party.name_en || null,
          data.party.national_id || null,
          data.party.economic_code || null,
          data.party.registration_number || null,
          data.party.postal_code || null,
          data.party.website || null,
          data.party.email || null,
          data.party.assigned_salesperson_id || null,
          data.party.customer_score_level || 'BRONZE',
          data.party.risk_flag || false,
          data.party.operational_balance || 0,
          data.party.status || 'ACTIVE',
          false,
          now,
          now,
        ]
      );

      // 2. Insert Roles
      for (const roleType of data.roles) {
        await client.query(
          `INSERT INTO party_roles (id, party_id, role_type, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), partyId, roleType, true, now]
        );
      }

      // 3. Insert Phones with database-level uniqueness enforcement
      for (const phone of data.phones) {
        await client.query(
          `INSERT INTO party_phones (
            id, company_id, party_id, phone_type, raw_number, normalized_number,
            is_primary, is_verified, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            crypto.randomUUID(),
            data.party.company_id,
            partyId,
            phone.phone_type,
            phone.raw_number,
            phone.normalized_number,
            Boolean(phone.is_primary),
            Boolean(phone.is_verified),
            now,
          ]
        );
      }

      // 4. Insert Addresses
      if (data.addresses && data.addresses.length > 0) {
        for (const addr of data.addresses) {
          await client.query(
            `INSERT INTO addresses (
              id, party_id, address_type, province, city, postal_code,
              address_line, is_default, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              crypto.randomUUID(),
              partyId,
              addr.address_type,
              addr.province,
              addr.city,
              addr.postal_code || null,
              addr.address_line,
              Boolean(addr.is_default),
              now,
            ]
          );
        }
      }

      // 5. Insert Contacts & Contact Phones
      if (data.contacts && data.contacts.length > 0) {
        for (const c of data.contacts) {
          const contactId = crypto.randomUUID();
          await client.query(
            `INSERT INTO contacts (
              id, company_party_id, full_name, position, email, is_primary, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              contactId,
              partyId,
              c.contact.full_name,
              c.contact.position || null,
              c.contact.email || null,
              Boolean(c.contact.is_primary),
              now,
            ]
          );

          for (const cph of c.phones) {
            await client.query(
              `INSERT INTO contact_phones (
                id, contact_id, phone_type, raw_number, normalized_number, is_primary
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                crypto.randomUUID(),
                contactId,
                cph.phone_type,
                cph.raw_number,
                cph.normalized_number,
                Boolean(cph.is_primary),
              ]
            );
          }
        }
      }

      // 6. Record Initial Timeline Event
      await client.query(
        `INSERT INTO timeline_events (id, party_id, event_type, title, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          partyId,
          'PARTY_CREATED',
          'ثبت طرف‌حساب در سامانه',
          `طرف‌حساب ${data.party.name_fa} با موفقیت در پایگاه‌داده ایجاد شد.`,
          now,
        ]
      );

      // 7. Atomic Audit Log Record (Reliable Audit Persistence)
      await client.query(
        `INSERT INTO audit_logs (id, company_id, entity_type, entity_id, action, user_id, reason, new_values, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          crypto.randomUUID(),
          data.party.company_id,
          'PARTY',
          partyId,
          'CREATE',
          data.party.assigned_salesperson_id || 'system',
          'ثبت طرف‌حساب جدید',
          JSON.stringify({ name_fa: data.party.name_fa, party_type: data.party.party_type, roles: data.roles }),
          now,
        ]
      );

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');

      // Database-level unique constraint violation (PostgreSQL 23505)
      if (err.code === '23505' || String(err.message).includes('uq_party_phones_company_normalized') || String(err.message).includes('unique')) {
        const match = data.phones.find(p => String(err.detail || err.message).includes(p.normalized_number));
        const duplicatePhone = match ? match.normalized_number : (data.phones[0]?.normalized_number || 'نامشخص');
        throw new DuplicatePhoneError(duplicatePhone);
      }
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findPartyById(partyId);
    if (!created) throw new Error('خطا در بازخوانی طرف‌حساب ایجاد شده.');
    return created;
  }

  public async updateParty(id: string, updates: Partial<Party>): Promise<Party> {
    const fields: string[] = [];
    const values: any[] = [];

    const allowedKeys: Array<keyof Party> = [
      'name_fa',
      'name_en',
      'national_id',
      'economic_code',
      'registration_number',
      'postal_code',
      'website',
      'email',
      'assigned_salesperson_id',
      'customer_score_level',
      'risk_flag',
      'operational_balance',
      'status',
    ];

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        values.push(updates[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }

    if (updates.status === 'ARCHIVED') {
      fields.push(`is_archived = true`);
    } else if (updates.status === 'ACTIVE') {
      fields.push(`is_archived = false`);
    }

    if (fields.length === 0) {
      const current = await this.findPartyById(id);
      if (!current) throw new Error(`طرف‌حساب با شناسه ${id} یافت نشد.`);
      return current;
    }

    values.push(new Date());
    fields.push(`updated_at = $${values.length}`);

    values.push(id);
    const idParam = `$${values.length}`;

    const res = await this.pool.query(
      `UPDATE parties SET ${fields.join(', ')} WHERE id = ${idParam} RETURNING *`,
      values
    );

    if (res.rows.length === 0) throw new Error(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    return this.mapPartyRow(res.rows[0]);
  }

  public async assignSalesperson(partyId: string, salespersonId: string | null): Promise<void> {
    await this.pool.query(
      'UPDATE parties SET assigned_salesperson_id = $1, updated_at = NOW() WHERE id = $2',
      [salespersonId, partyId]
    );
  }

  public async addPartyPhone(phone: Omit<PartyPhone, 'id' | 'created_at'>): Promise<PartyPhone> {
    const id = crypto.randomUUID();
    const now = new Date();

    try {
      await this.pool.query(
        `INSERT INTO party_phones (
          id, company_id, party_id, phone_type, raw_number, normalized_number,
          is_primary, is_verified, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          phone.company_id,
          phone.party_id,
          phone.phone_type,
          phone.raw_number,
          phone.normalized_number,
          Boolean(phone.is_primary),
          Boolean(phone.is_verified),
          now,
        ]
      );
    } catch (err: any) {
      if (err.code === '23505' || String(err.message).includes('uq_party_phones_company_normalized')) {
        throw new DuplicatePhoneError(phone.normalized_number);
      }
      throw err;
    }

    return {
      ...phone,
      id,
      created_at: now.toISOString(),
    };
  }

  public async addContact(
    contact: Omit<Contact, 'id' | 'created_at'>,
    phones: Array<Omit<ContactPhone, 'id' | 'contact_id'>>
  ): Promise<Contact & { phones: ContactPhone[] }> {
    const client = await this.pool.connect();
    const contactId = crypto.randomUUID();
    const now = new Date();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO contacts (
          id, company_party_id, full_name, position, email, is_primary, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          contactId,
          contact.company_party_id,
          contact.full_name,
          contact.position || null,
          contact.email || null,
          Boolean(contact.is_primary),
          now,
        ]
      );

      const createdPhones: ContactPhone[] = [];
      for (const p of phones) {
        const pId = crypto.randomUUID();
        await client.query(
          `INSERT INTO contact_phones (
            id, contact_id, phone_type, raw_number, normalized_number, is_primary
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [pId, contactId, p.phone_type, p.raw_number, p.normalized_number, Boolean(p.is_primary)]
        );
        createdPhones.push({
          id: pId,
          contact_id: contactId,
          phone_type: p.phone_type,
          raw_number: p.raw_number,
          normalized_number: p.normalized_number,
          is_primary: Boolean(p.is_primary),
        });
      }

      await client.query('COMMIT');

      return {
        ...contact,
        id: contactId,
        created_at: now.toISOString(),
        phones: createdPhones,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async addAddress(address: Omit<Address, 'id' | 'created_at'>): Promise<Address> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO addresses (
        id, party_id, address_type, province, city, postal_code, address_line, is_default, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        address.party_id,
        address.address_type,
        address.province,
        address.city,
        address.postal_code || null,
        address.address_line,
        Boolean(address.is_default),
        now,
      ]
    );

    return {
      ...address,
      id,
      created_at: now.toISOString(),
    };
  }

  public async linkFinancialResponsibility(
    companyId: string,
    guarantorPartyId: string,
    guaranteedPartyId: string,
    notes?: string
  ): Promise<FinancialResponsibility> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO financial_responsibilities (
        id, company_id, guarantor_party_id, guaranteed_party_id, notes, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, companyId, guarantorPartyId, guaranteedPartyId, notes || null, true, now]
    );

    return {
      id,
      company_id: companyId,
      guarantor_party_id: guarantorPartyId,
      guaranteed_party_id: guaranteedPartyId,
      notes,
      is_active: true,
      created_at: now.toISOString(),
    };
  }

  public async getFinancialResponsibilityReport(guarantorPartyId: string): Promise<ConsolidatedResponsibilityReport> {
    const guarantor = await this.findPartyById(guarantorPartyId);
    if (!guarantor) throw new Error('ضامن یافت نشد.');

    const linksRes = await this.pool.query(
      `SELECT fr.*, p.id as p_id, p.name_fa as p_name, p.operational_balance as p_bal 
       FROM financial_responsibilities fr 
       JOIN parties p ON fr.guaranteed_party_id = p.id 
       WHERE fr.guarantor_party_id = $1 AND fr.is_active = true`,
      [guarantorPartyId]
    );

    const guaranteedParties: Array<{ party: Party; individualDebt: number }> = [];
    let totalConsolidatedDebt = Math.max(0, guarantor.operational_balance || 0);

    for (const row of linksRes.rows) {
      const gParty = await this.findPartyById(row.p_id);
      if (gParty) {
        const debt = Math.max(0, gParty.operational_balance || 0);
        guaranteedParties.push({
          party: gParty,
          individualDebt: debt,
        });
        totalConsolidatedDebt += debt;
      }
    }

    return {
      guarantor,
      guaranteedParties,
      totalConsolidatedDebt,
    };
  }

  public async recordScoreHistory(history: Omit<CustomerScoreHistory, 'id'>): Promise<CustomerScoreHistory> {
    const id = crypto.randomUUID();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO customer_score_histories (
          id, party_id, score_level, computed_score, metrics_snapshot, effective_date
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          history.party_id,
          history.score_level,
          history.computed_score,
          JSON.stringify(history.metrics_snapshot),
          new Date(history.effective_date),
        ]
      );

      await client.query(
        'UPDATE parties SET customer_score_level = $1, updated_at = NOW() WHERE id = $2',
        [history.score_level, history.party_id]
      );

      await client.query('COMMIT');

      return {
        ...history,
        id,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async addTimelineEvent(event: Omit<TimelineEvent, 'id' | 'created_at'>): Promise<TimelineEvent> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO timeline_events (
        id, party_id, event_type, title, description, actor_user_id, actor_name, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        event.party_id,
        event.event_type,
        event.title,
        event.description || null,
        event.actor_user_id || null,
        event.actor_name || null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        now,
      ]
    );

    return {
      ...event,
      id,
      created_at: now.toISOString(),
    };
  }

  public async getTimelineEvents(partyId: string): Promise<TimelineEvent[]> {
    const res = await this.pool.query(
      'SELECT * FROM timeline_events WHERE party_id = $1 ORDER BY created_at DESC',
      [partyId]
    );

    return res.rows.map(r => ({
      id: r.id,
      party_id: r.party_id,
      event_type: r.event_type,
      title: r.title,
      description: r.description || undefined,
      actor_user_id: r.actor_user_id || undefined,
      actor_name: r.actor_name || undefined,
      metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : undefined,
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  public async archiveParty(partyId: string): Promise<void> {
    await this.pool.query(
      "UPDATE parties SET is_archived = true, status = 'ARCHIVED', updated_at = NOW() WHERE id = $1",
      [partyId]
    );
  }
}

// Default singleton instance using the standard PostgreSQL pool
export const partyRepository = new PostgresPartyRepository();
