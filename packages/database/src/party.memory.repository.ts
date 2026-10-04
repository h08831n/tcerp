/**
 * TCERP - Explicit Test Double: In-Memory Party Repository
 * Package: @tcerp/database
 *
 * Used exclusively for offline unit testing where database initialization is bypassed.
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
import { IPartyRepository, PartyDetail } from './party.repository';

export class InMemoryPartyRepository implements IPartyRepository {
  private parties: Map<string, Party> = new Map();
  private roles: Map<string, PartyRole[]> = new Map();
  private phones: Map<string, PartyPhone[]> = new Map();
  private contacts: Map<string, Array<Contact & { phones: ContactPhone[] }>> = new Map();
  private addresses: Map<string, Address[]> = new Map();
  private financialLinks: FinancialResponsibility[] = [];
  private timeline: TimelineEvent[] = [];
  private scoreHistories: Map<string, CustomerScoreHistory[]> = new Map();

  public async findPartyById(id: string): Promise<PartyDetail | null> {
    const party = this.parties.get(id);
    if (!party) return null;

    return {
      ...party,
      roles: this.roles.get(id) || [],
      phones: this.phones.get(id) || [],
      contacts: this.contacts.get(id) || [],
      addresses: this.addresses.get(id) || [],
      scoreHistory: this.scoreHistories.get(id) || [],
    };
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
    let list = Array.from(this.parties.values()).filter(p => p.company_id === options.companyId);

    if (!options.includeArchived) {
      list = list.filter(p => p.status !== 'ARCHIVED');
    }

    if (options.status) {
      list = list.filter(p => p.status === options.status);
    }

    if (options.assignedSalespersonId) {
      list = list.filter(p => p.assigned_salesperson_id === options.assignedSalespersonId);
    } else if (options.teamSalespersonIds && options.teamSalespersonIds.length > 0) {
      list = list.filter(p => p.assigned_salesperson_id && options.teamSalespersonIds!.includes(p.assigned_salesperson_id));
    }

    if (options.role) {
      list = list.filter(p => {
        const rList = this.roles.get(p.id) || [];
        return rList.some(r => r.role_type === options.role && r.is_active);
      });
    }

    if (options.query) {
      const q = options.query.trim().toLowerCase();
      list = list.filter(p => {
        const matchesName = p.name_fa.toLowerCase().includes(q) || (p.name_en && p.name_en.toLowerCase().includes(q));
        const matchesNational = p.national_id && p.national_id.includes(q);
        const phones = this.phones.get(p.id) || [];
        const matchesPhone = phones.some(ph => ph.normalized_number.includes(q) || ph.raw_number.includes(q));
        return matchesName || matchesNational || matchesPhone;
      });
    }

    const total = list.length;
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const paged = list.slice(start, start + limit);

    const detailed: PartyDetail[] = [];
    for (const p of paged) {
      const d = await this.findPartyById(p.id);
      if (d) detailed.push(d);
    }

    return { parties: detailed, total };
  }

  public async checkDuplicatePhones(companyId: string, normalizedPhones: string[]): Promise<string[]> {
    const duplicates: string[] = [];
    for (const [, phoneList] of this.phones.entries()) {
      for (const ph of phoneList) {
        if (ph.company_id === companyId && normalizedPhones.includes(ph.normalized_number)) {
          duplicates.push(ph.normalized_number);
        }
      }
    }
    return Array.from(new Set(duplicates));
  }

  public async findSimilarNames(
    companyId: string,
    nameFa: string,
    threshold: number = 0.85
  ): Promise<Array<{ party: Party; similarity: number }>> {
    const matches: Array<{ party: Party; similarity: number }> = [];
    for (const p of this.parties.values()) {
      if (p.company_id !== companyId) continue;
      const sim = calculateTrigramSimilarity(nameFa, p.name_fa);
      if (sim >= threshold) {
        matches.push({ party: p, similarity: sim });
      }
    }
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

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
    const partyId = 'pty-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const newParty: Party = {
      ...data.party,
      id: partyId,
      created_at: now,
      updated_at: now,
    };
    this.parties.set(partyId, newParty);

    const rList: PartyRole[] = data.roles.map(r => ({
      id: 'rol-' + Math.random().toString(36).substring(2, 9),
      party_id: partyId,
      role_type: r,
      is_active: true,
      created_at: now,
    }));
    this.roles.set(partyId, rList);

    const phList: PartyPhone[] = data.phones.map(ph => ({
      ...ph,
      id: 'phn-' + Math.random().toString(36).substring(2, 9),
      party_id: partyId,
      created_at: now,
    }));
    this.phones.set(partyId, phList);

    const adList: Address[] = (data.addresses || []).map(ad => ({
      ...ad,
      id: 'adr-' + Math.random().toString(36).substring(2, 9),
      party_id: partyId,
      created_at: now,
    }));
    this.addresses.set(partyId, adList);

    const ctList: Array<Contact & { phones: ContactPhone[] }> = [];
    for (const c of data.contacts || []) {
      const cId = 'ctc-' + Math.random().toString(36).substring(2, 9);
      const ctPhones: ContactPhone[] = c.phones.map(cph => ({
        ...cph,
        id: 'cph-' + Math.random().toString(36).substring(2, 9),
        contact_id: cId,
      }));
      ctList.push({
        ...c.contact,
        id: cId,
        company_party_id: partyId,
        created_at: now,
        phones: ctPhones,
      });
    }
    this.contacts.set(partyId, ctList);

    return (await this.findPartyById(partyId))!;
  }

  public async updateParty(id: string, updates: Partial<Party>): Promise<Party> {
    const existing = this.parties.get(id);
    if (!existing) throw new Error(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    this.parties.set(id, updated);
    return updated;
  }

  public async assignSalesperson(partyId: string, salespersonId: string | null): Promise<void> {
    const party = this.parties.get(partyId);
    if (party) {
      party.assigned_salesperson_id = salespersonId || undefined;
      party.updated_at = new Date().toISOString();
    }
  }

  public async addPartyPhone(phone: Omit<PartyPhone, 'id' | 'created_at'>): Promise<PartyPhone> {
    const id = 'phn-' + Math.random().toString(36).substring(2, 9);
    const created: PartyPhone = { ...phone, id, created_at: new Date().toISOString() };
    const list = this.phones.get(phone.party_id) || [];
    list.push(created);
    this.phones.set(phone.party_id, list);
    return created;
  }

  public async addContact(
    contact: Omit<Contact, 'id' | 'created_at'>,
    phones: Array<Omit<ContactPhone, 'id' | 'contact_id'>>
  ): Promise<Contact & { phones: ContactPhone[] }> {
    const cId = 'ctc-' + Math.random().toString(36).substring(2, 9);
    const contactPhones: ContactPhone[] = phones.map(p => ({
      ...p,
      id: 'cph-' + Math.random().toString(36).substring(2, 9),
      contact_id: cId,
    }));
    const fullContact: Contact & { phones: ContactPhone[] } = {
      ...contact,
      id: cId,
      created_at: new Date().toISOString(),
      phones: contactPhones,
    };
    const list = this.contacts.get(contact.company_party_id) || [];
    list.push(fullContact);
    this.contacts.set(contact.company_party_id, list);
    return fullContact;
  }

  public async addAddress(address: Omit<Address, 'id' | 'created_at'>): Promise<Address> {
    const id = 'adr-' + Math.random().toString(36).substring(2, 9);
    const created: Address = { ...address, id, created_at: new Date().toISOString() };
    const list = this.addresses.get(address.party_id) || [];
    list.push(created);
    this.addresses.set(address.party_id, list);
    return created;
  }

  public async linkFinancialResponsibility(
    companyId: string,
    guarantorPartyId: string,
    guaranteedPartyId: string,
    notes?: string
  ): Promise<FinancialResponsibility> {
    const link: FinancialResponsibility = {
      id: 'fr-' + Math.random().toString(36).substring(2, 9),
      company_id: companyId,
      guarantor_party_id: guarantorPartyId,
      guaranteed_party_id: guaranteedPartyId,
      notes,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.financialLinks.push(link);
    return link;
  }

  public async getFinancialResponsibilityReport(guarantorPartyId: string): Promise<ConsolidatedResponsibilityReport> {
    const guarantor = await this.findPartyById(guarantorPartyId);
    if (!guarantor) throw new Error('ضامن یافت نشد.');

    const activeLinks = this.financialLinks.filter(l => l.guarantor_party_id === guarantorPartyId && l.is_active);
    const guaranteedParties: Array<{ party: Party; individualDebt: number }> = [];
    let totalConsolidatedDebt = Math.max(0, guarantor.operational_balance || 0);

    for (const link of activeLinks) {
      const gParty = this.parties.get(link.guaranteed_party_id);
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
    const id = 'csh-' + Math.random().toString(36).substring(2, 9);
    const rec: CustomerScoreHistory = { ...history, id };
    const list = this.scoreHistories.get(history.party_id) || [];
    list.push(rec);
    this.scoreHistories.set(history.party_id, list);

    const party = this.parties.get(history.party_id);
    if (party) {
      party.customer_score_level = history.score_level;
      party.updated_at = new Date().toISOString();
    }
    return rec;
  }

  public async addTimelineEvent(event: Omit<TimelineEvent, 'id' | 'created_at'>): Promise<TimelineEvent> {
    const rec: TimelineEvent = {
      ...event,
      id: 'evt-' + Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
    };
    this.timeline.push(rec);
    return rec;
  }

  public async getTimelineEvents(partyId: string): Promise<TimelineEvent[]> {
    return this.timeline
      .filter(e => e.party_id === partyId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async archiveParty(partyId: string): Promise<void> {
    const party = this.parties.get(partyId);
    if (party) {
      party.status = 'ARCHIVED';
      party.updated_at = new Date().toISOString();
    }
  }
}
