/**
 * TCERP - Party & CRM PostgreSQL / Stateful Persistence Repository
 * Package: @tcerp/database
 */

import {
  Address,
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
  TimelineEvent,
} from '@tcerp/domain';
import { calculateTrigramSimilarity } from '@tcerp/shared';

export interface PartyDetail extends Party {
  roles: PartyRole[];
  phones: PartyPhone[];
  contacts: Array<Contact & { phones: ContactPhone[] }>;
  addresses: Address[];
  scoreHistory?: CustomerScoreHistory[];
  guarantorFor?: Party[];
  guaranteedBy?: Party[];
}

export class PartyRepository {
  private parties: Map<string, Party> = new Map();
  private roles: Map<string, PartyRole[]> = new Map(); // partyId -> PartyRole[]
  private phones: Map<string, PartyPhone[]> = new Map(); // partyId -> PartyPhone[]
  private contacts: Map<string, Array<Contact & { phones: ContactPhone[] }>> = new Map();
  private addresses: Map<string, Address[]> = new Map();
  private financialLinks: FinancialResponsibility[] = [];
  private timeline: TimelineEvent[] = [];
  private scoreHistories: Map<string, CustomerScoreHistory[]> = new Map();

  constructor() {
    this.seedInitialParties();
  }

  private seedInitialParties(): void {
    const companyId = 'comp-001-arvin';

    // Seed 1: Arvin Steel (Both Customer and Supplier)
    const party1: Party = {
      id: 'party-arvin',
      company_id: companyId,
      party_type: 'COMPANY',
      name_fa: 'شرکت فولاد تجارت آروین',
      name_en: 'Arvin Steel Trading',
      national_id: '10103456789',
      economic_code: '411567891234',
      registration_number: '456789',
      postal_code: '1998765432',
      assigned_salesperson_id: 'usr-admin-01',
      customer_score_level: 'VIP',
      risk_flag: false,
      operational_balance: 0,
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.parties.set(party1.id, party1);
    this.roles.set(party1.id, [
      { id: 'r1', party_id: party1.id, role_type: 'CUSTOMER', is_active: true, created_at: new Date().toISOString() },
      { id: 'r2', party_id: party1.id, role_type: 'SUPPLIER', is_active: true, created_at: new Date().toISOString() },
    ]);
    this.phones.set(party1.id, [
      { id: 'ph1', company_id: companyId, party_id: party1.id, phone_type: 'WORK_PHONE', raw_number: '021-88997766', normalized_number: '+982188997766', is_primary: true, is_verified: true, created_at: new Date().toISOString() },
      { id: 'ph2', company_id: companyId, party_id: party1.id, phone_type: 'MOBILE', raw_number: '09121111111', normalized_number: '+989121111111', is_primary: false, is_verified: true, created_at: new Date().toISOString() },
    ]);

    // Seed 2: Mr. Ravan (Guarantor for multiple entities)
    const partyRavan: Party = {
      id: 'party-ravan',
      company_id: companyId,
      party_type: 'PERSON',
      name_fa: 'محمدرضا روان',
      name_en: 'Mohammadreza Ravan',
      national_id: '0061234567',
      assigned_salesperson_id: 'usr-admin-01',
      customer_score_level: 'VIP',
      risk_flag: false,
      operational_balance: 200_000_000, // 200M individual debt
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.parties.set(partyRavan.id, partyRavan);
    this.roles.set(partyRavan.id, [{ id: 'rr1', party_id: partyRavan.id, role_type: 'CUSTOMER', is_active: true, created_at: '' }]);
    this.phones.set(partyRavan.id, [{ id: 'phr1', company_id: companyId, party_id: partyRavan.id, phone_type: 'MOBILE', raw_number: '09128888888', normalized_number: '+989128888888', is_primary: true, is_verified: true, created_at: '' }]);

    // Seed 3: Subsidiary Company A (Guaranteed by Mr. Ravan)
    const partySubA: Party = {
      id: 'party-sub-a',
      company_id: companyId,
      party_type: 'COMPANY',
      name_fa: 'صنایع فولاد پرتو غرب',
      national_id: '10109988771',
      assigned_salesperson_id: 'usr-admin-01',
      customer_score_level: 'GOLD',
      risk_flag: false,
      operational_balance: 500_000_000, // 500M individual debt
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.parties.set(partySubA.id, partySubA);
    this.roles.set(partySubA.id, [{ id: 'rsa1', party_id: partySubA.id, role_type: 'CUSTOMER', is_active: true, created_at: '' }]);
    this.phones.set(partySubA.id, [{ id: 'phsa1', company_id: companyId, party_id: partySubA.id, phone_type: 'MOBILE', raw_number: '09127777777', normalized_number: '+989127777777', is_primary: true, is_verified: true, created_at: '' }]);

    // Seed 4: Subsidiary Company B (Guaranteed by Mr. Ravan)
    const partySubB: Party = {
      id: 'party-sub-b',
      company_id: companyId,
      party_type: 'COMPANY',
      name_fa: 'آهن‌سازه نوین زاگرس',
      national_id: '10105544332',
      assigned_salesperson_id: 'usr-admin-01',
      customer_score_level: 'SILVER',
      risk_flag: false,
      operational_balance: 300_000_000, // 300M individual debt
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.parties.set(partySubB.id, partySubB);
    this.roles.set(partySubB.id, [{ id: 'rsb1', party_id: partySubB.id, role_type: 'CUSTOMER', is_active: true, created_at: '' }]);
    this.phones.set(partySubB.id, [{ id: 'phsb1', company_id: companyId, party_id: partySubB.id, phone_type: 'MOBILE', raw_number: '09126666666', normalized_number: '+989126666666', is_primary: true, is_verified: true, created_at: '' }]);

    // Financial Responsibility Links: Mr. Ravan guarantees Sub A and Sub B
    this.financialLinks.push(
      { id: 'fr1', company_id: companyId, guarantor_party_id: partyRavan.id, guaranteed_party_id: partySubA.id, is_active: true, notes: 'ضمانت تجمیعی پرداخت', created_at: new Date().toISOString() },
      { id: 'fr2', company_id: companyId, guarantor_party_id: partyRavan.id, guaranteed_party_id: partySubB.id, is_active: true, notes: 'ضمانت تجمیعی پرداخت', created_at: new Date().toISOString() }
    );
  }

  // --- CRUD Operations ---

  public async createParty(
    party: Party,
    initialRoles: PartyRoleType[] = [],
    initialPhones: Array<Omit<PartyPhone, 'id' | 'party_id' | 'company_id' | 'created_at'>> = []
  ): Promise<PartyDetail> {
    this.parties.set(party.id, party);

    const rolesList: PartyRole[] = initialRoles.map(role => ({
      id: crypto.randomUUID(),
      party_id: party.id,
      role_type: role,
      is_active: true,
      created_at: new Date().toISOString(),
    }));
    this.roles.set(party.id, rolesList);

    const phonesList: PartyPhone[] = initialPhones.map(p => ({
      ...p,
      id: crypto.randomUUID(),
      company_id: party.company_id,
      party_id: party.id,
      created_at: new Date().toISOString(),
    }));
    this.phones.set(party.id, phonesList);
    this.contacts.set(party.id, []);
    this.addresses.set(party.id, []);

    // Timeline event
    this.addTimelineEvent({
      id: crypto.randomUUID(),
      party_id: party.id,
      event_type: 'PARTY_CREATED',
      title: 'ثبت طرف‌حساب جدید',
      description: `طرف‌حساب "${party.name_fa}" با نوع ${party.party_type} در سیستم ثبت شد.`,
      created_at: new Date().toISOString(),
    });

    return (await this.findPartyById(party.id))!;
  }

  public async updateParty(partyId: string, updates: Partial<Party>): Promise<PartyDetail> {
    const existing = this.parties.get(partyId);
    if (!existing) throw new Error('Party not found');

    const updated: Party = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.parties.set(partyId, updated);

    return (await this.findPartyById(partyId))!;
  }

  public async findPartyById(partyId: string): Promise<PartyDetail | undefined> {
    const p = this.parties.get(partyId);
    if (!p) return undefined;

    return {
      ...p,
      roles: this.roles.get(partyId) || [],
      phones: this.phones.get(partyId) || [],
      contacts: this.contacts.get(partyId) || [],
      addresses: this.addresses.get(partyId) || [],
      scoreHistory: this.scoreHistories.get(partyId) || [],
    };
  }

  public async findParties(filter: {
    companyId: string;
    query?: string;
    role?: PartyRoleType;
    salespersonId?: string;
    status?: string;
    includeArchived?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: PartyDetail[]; total: number }> {
    let list = Array.from(this.parties.values()).filter(p => p.company_id === filter.companyId);

    // Default: exclude archived parties unless requested
    if (!filter.includeArchived) {
      list = list.filter(p => p.status !== 'ARCHIVED');
    }

    if (filter.status) {
      list = list.filter(p => p.status === filter.status);
    }

    if (filter.salespersonId) {
      list = list.filter(p => p.assigned_salesperson_id === filter.salespersonId);
    }

    if (filter.role) {
      list = list.filter(p => {
        const partyRoles = this.roles.get(p.id) || [];
        return partyRoles.some(r => r.role_type === filter.role && r.is_active);
      });
    }

    if (filter.query && filter.query.trim()) {
      const q = filter.query.trim().toLowerCase();
      list = list.filter(p => {
        const matchNameFa = p.name_fa.toLowerCase().includes(q);
        const matchNameEn = p.name_en?.toLowerCase().includes(q);
        const matchNatId = p.national_id?.includes(q);
        const matchEcon = p.economic_code?.includes(q);
        const matchReg = p.registration_number?.includes(q);

        const partyPhones = this.phones.get(p.id) || [];
        const matchPhone = partyPhones.some(ph => ph.normalized_number.includes(q) || ph.raw_number.includes(q));

        return matchNameFa || matchNameEn || matchNatId || matchEcon || matchReg || matchPhone;
      });
    }

    const total = list.length;
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;

    const paged = list.slice(offset, offset + limit);
    const details = await Promise.all(paged.map(p => this.findPartyById(p.id)));

    return {
      items: details.filter(Boolean) as PartyDetail[],
      total,
    };
  }

  // --- Duplicate Detection Queries ---

  public async findByNormalizedPhone(companyId: string, normalizedNumber: string): Promise<{ party: Party; phone: PartyPhone } | undefined> {
    for (const [partyId, phones] of this.phones.entries()) {
      const match = phones.find(ph => ph.company_id === companyId && ph.normalized_number === normalizedNumber);
      if (match) {
        const party = this.parties.get(partyId);
        if (party) {
          return { party, phone: match };
        }
      }
    }
    return undefined;
  }

  public async findSimilarNames(
    companyId: string,
    nameFa: string,
    excludePartyId?: string,
    threshold = 0.85
  ): Promise<Array<{ party: Party; similarityScore: number }>> {
    const candidates: Array<{ party: Party; similarityScore: number }> = [];

    for (const party of this.parties.values()) {
      if (party.company_id !== companyId) continue;
      if (excludePartyId && party.id === excludePartyId) continue;

      const sim = calculateTrigramSimilarity(nameFa, party.name_fa);
      if (sim >= threshold) {
        candidates.push({ party, similarityScore: sim });
      }
    }

    return candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  // --- Roles, Phones, Contacts, Addresses ---

  public async addRole(partyId: string, roleType: PartyRoleType): Promise<PartyRole> {
    const party = this.parties.get(partyId);
    if (!party) throw new Error('Party not found');

    const existing = this.roles.get(partyId) || [];
    const found = existing.find(r => r.role_type === roleType);
    if (found) {
      found.is_active = true;
      return found;
    }

    const newRole: PartyRole = {
      id: crypto.randomUUID(),
      party_id: partyId,
      role_type: roleType,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    existing.push(newRole);
    this.roles.set(partyId, existing);

    this.addTimelineEvent({
      id: crypto.randomUUID(),
      party_id: partyId,
      event_type: 'ROLE_CHANGED',
      title: 'افزودن نقش به طرف‌حساب',
      description: `نقش "${roleType}" به طرف‌حساب افزوده شد.`,
      created_at: new Date().toISOString(),
    });

    return newRole;
  }

  public async addPhone(phone: Omit<PartyPhone, 'id' | 'created_at'>): Promise<PartyPhone> {
    const existing = this.phones.get(phone.party_id) || [];
    const newPhone: PartyPhone = {
      ...phone,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (newPhone.is_primary) {
      existing.forEach(p => (p.is_primary = false));
    }

    existing.push(newPhone);
    this.phones.set(phone.party_id, existing);

    this.addTimelineEvent({
      id: crypto.randomUUID(),
      party_id: phone.party_id,
      event_type: 'PHONE_ADDED',
      title: 'افزودن شماره تماس جدید',
      description: `شماره ${phone.normalized_number} (${phone.phone_type}) افزوده شد.`,
      created_at: new Date().toISOString(),
    });

    return newPhone;
  }

  public async addContact(
    contact: Omit<Contact, 'id' | 'created_at'>,
    phones: Array<Omit<ContactPhone, 'id' | 'contact_id'>> = []
  ): Promise<Contact & { phones: ContactPhone[] }> {
    const contactId = crypto.randomUUID();
    const contactPhonesList: ContactPhone[] = phones.map(p => ({
      ...p,
      id: crypto.randomUUID(),
      contact_id: contactId,
    }));

    const fullContact: Contact & { phones: ContactPhone[] } = {
      ...contact,
      id: contactId,
      created_at: new Date().toISOString(),
      phones: contactPhonesList,
    };

    const existing = this.contacts.get(contact.company_party_id) || [];
    existing.push(fullContact);
    this.contacts.set(contact.company_party_id, existing);

    this.addTimelineEvent({
      id: crypto.randomUUID(),
      party_id: contact.company_party_id,
      event_type: 'CONTACT_ADDED',
      title: 'ثبت مخاطب/رابط سازمانی',
      description: `مخاطب جدید: ${contact.full_name} (${contact.position || 'بدون سمت'})`,
      created_at: new Date().toISOString(),
    });

    return fullContact;
  }

  public async addAddress(address: Omit<Address, 'id' | 'created_at'>): Promise<Address> {
    const existing = this.addresses.get(address.party_id) || [];
    const newAddress: Address = {
      ...address,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (newAddress.is_default) {
      existing.filter(a => a.address_type === newAddress.address_type).forEach(a => (a.is_default = false));
    }

    existing.push(newAddress);
    this.addresses.set(address.party_id, existing);

    this.addTimelineEvent({
      id: crypto.randomUUID(),
      party_id: address.party_id,
      event_type: 'ADDRESS_ADDED',
      title: 'ثبت آدرس جدید',
      description: `آدرس نوع ${address.address_type}: ${address.province}، ${address.city}`,
      created_at: new Date().toISOString(),
    });

    return newAddress;
  }

  // --- Financial Responsibility Consolidation ---

  public async linkFinancialResponsibility(
    companyId: string,
    guarantorPartyId: string,
    guaranteedPartyId: string,
    notes?: string
  ): Promise<FinancialResponsibility> {
    if (guarantorPartyId === guaranteedPartyId) {
      throw new Error('Guarantor cannot be the same as guaranteed party');
    }

    const link: FinancialResponsibility = {
      id: crypto.randomUUID(),
      company_id: companyId,
      guarantor_party_id: guarantorPartyId,
      guaranteed_party_id: guaranteedPartyId,
      notes,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    this.financialLinks.push(link);

    this.addTimelineEvent({
      id: crypto.randomUUID(),
      party_id: guaranteedPartyId,
      event_type: 'FINANCIAL_RESPONSIBILITY_LINKED',
      title: 'اتصال به ضامن مالی',
      description: `تعهدات مالی این طرف‌حساب ذیل ضامن با شناسه ${guarantorPartyId} تجمیع می‌گردد.`,
      created_at: new Date().toISOString(),
    });

    return link;
  }

  public async getFinancialResponsibilityReport(guarantorPartyId: string): Promise<ConsolidatedResponsibilityReport> {
    const guarantor = this.parties.get(guarantorPartyId);
    if (!guarantor) throw new Error('Guarantor party not found');

    const links = this.financialLinks.filter(l => l.guarantor_party_id === guarantorPartyId && l.is_active);
    const guaranteedParties: Array<{ party: Party; individualDebt: number }> = [];

    let totalConsolidatedDebt = guarantor.operational_balance;

    for (const link of links) {
      const sub = this.parties.get(link.guaranteed_party_id);
      if (sub) {
        guaranteedParties.push({
          party: sub,
          individualDebt: sub.operational_balance,
        });
        totalConsolidatedDebt += sub.operational_balance;
      }
    }

    return {
      guarantor,
      guaranteedParties,
      totalConsolidatedDebt,
    };
  }

  // --- Timeline & Scoring ---

  public addTimelineEvent(event: TimelineEvent): void {
    this.timeline.unshift(event);
  }

  public async getTimelineEvents(partyId: string): Promise<TimelineEvent[]> {
    return this.timeline.filter(e => e.party_id === partyId);
  }

  public async updateScore(
    partyId: string,
    score: number,
    level: CustomerScoreLevel,
    metrics: CustomerScoreHistory['metrics_snapshot']
  ): Promise<void> {
    const party = this.parties.get(partyId);
    if (!party) return;

    party.customer_score_level = level;
    party.updated_at = new Date().toISOString();

    const history: CustomerScoreHistory = {
      id: crypto.randomUUID(),
      party_id: partyId,
      score_level: level,
      computed_score: score,
      metrics_snapshot: metrics,
      effective_date: new Date().toISOString(),
    };

    const existingHist = this.scoreHistories.get(partyId) || [];
    existingHist.unshift(history);
    this.scoreHistories.set(partyId, existingHist);

    this.addTimelineEvent({
      id: crypto.randomUUID(),
      party_id: partyId,
      event_type: 'SCORE_UPDATED',
      title: 'بروزرسانی رتبه مشتری',
      description: `رتبه مشتری به سطح ${level} (امتیاز: ${score}) ارتقا یافت.`,
      metadata: { score, level, metrics },
      created_at: new Date().toISOString(),
    });
  }
}

export const partyRepository = new PartyRepository();
