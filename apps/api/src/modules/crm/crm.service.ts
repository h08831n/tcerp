/**
 * TCERP - CRM Application Service
 * Package: @tcerp/api
 */

import {
  Address,
  AddressType,
  ConsolidatedResponsibilityReport,
  Contact,
  ContactPhone,
  DuplicateCheckResult,
  FinancialResponsibility,
  Party,
  PartyPhone,
  PartyRole,
  PartyRoleType,
  PartyType,
  PhoneType,
  TimelineEvent,
  User,
} from '@tcerp/domain';
import { partyRepository, PartyDetail } from '@tcerp/database';
import {
  normalizeCanonicalPhone,
  CustomerMetricsInput,
  CustomerScoringConfig,
  CustomerScoreResult,
  calculateCustomerScore,
  DEFAULT_CUSTOMER_SCORING_CONFIG,
} from '@tcerp/shared';
import { auditService } from '../audit/audit.service';
import { PermissionGuard, SecurityContext } from '../iam/permission.guard';

export class CrmService {
  /**
   * Pre-check for duplicate mobile numbers and similar names.
   */
  public async checkDuplicates(
    companyId: string,
    params: { nameFa: string; mobileNumber?: string; excludePartyId?: string },
    userCtx: SecurityContext
  ): Promise<DuplicateCheckResult> {
    const result: DuplicateCheckResult = {
      possibleDuplicates: [],
    };

    // 1. Exact normalized mobile check
    if (params.mobileNumber) {
      const canonical = normalizeCanonicalPhone(params.mobileNumber);
      const existing = await partyRepository.findByNormalizedPhone(companyId, canonical);

      if (existing && (!params.excludePartyId || existing.party.id !== params.excludePartyId)) {
        const canViewAll = PermissionGuard.can(userCtx, 'crm', 'view_all_salespersons').allowed;
        const isOwner = existing.party.assigned_salesperson_id === userCtx.user.id;

        result.exactDuplicateMobile = {
          party: existing.party,
          phone: existing.phone,
          ownerSalespersonName: (canViewAll || isOwner) ? (existing.party.assigned_salesperson_id || 'نامشخص') : undefined,
          hasAccessToOwner: canViewAll || isOwner,
        };
      }
    }

    // 2. Similar name check (pg_trgm >= 85%)
    if (params.nameFa) {
      const similar = await partyRepository.findSimilarNames(
        companyId,
        params.nameFa,
        params.excludePartyId,
        0.85
      );
      result.possibleDuplicates = similar.map(s => ({
        party: s.party,
        similarityScore: s.similarity,
      }));
    }

    return result;
  }

  /**
   * Creates a new Party with duplicate prevention rules and audit trail.
   */
  public async createParty(
    companyId: string,
    data: {
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
      initialRoles?: PartyRoleType[];
      phones?: Array<{ phone_type: PhoneType; raw_number: string; is_primary?: boolean }>;
    },
    userCtx: SecurityContext
  ): Promise<{ party: PartyDetail; duplicateWarning?: string }> {
    // Check mobile duplicate
    const primaryMobile = data.phones?.find(p => p.phone_type === 'MOBILE');
    if (primaryMobile) {
      const dupCheck = await this.checkDuplicates(
        companyId,
        { nameFa: data.name_fa, mobileNumber: primaryMobile.raw_number },
        userCtx
      );

      if (dupCheck.exactDuplicateMobile) {
        const dupInfo = dupCheck.exactDuplicateMobile;
        const ownerMsg = dupInfo.hasAccessToOwner
          ? `این طرف‌حساب متعلق به کارشناس "${dupInfo.ownerSalespersonName}" است.`
          : 'این مشتری قبلاً در سیستم ثبت شده و به کارشناس دیگری تخصیص دارد.';
        throw new Error(`خطای تکرار: شماره موبایل ${dupInfo.phone.normalized_number} متعلق به "${dupInfo.party.name_fa}" است. ${ownerMsg}`);
      }
    }

    const partyId = crypto.randomUUID();
    const newParty: Party = {
      id: partyId,
      company_id: companyId,
      party_type: data.party_type,
      name_fa: data.name_fa.trim(),
      name_en: data.name_en?.trim(),
      national_id: data.national_id?.trim(),
      economic_code: data.economic_code?.trim(),
      registration_number: data.registration_number?.trim(),
      postal_code: data.postal_code?.trim(),
      website: data.website?.trim(),
      email: data.email?.trim(),
      assigned_salesperson_id: data.assigned_salesperson_id || userCtx.user.id,
      customer_score_level: 'BRONZE',
      risk_flag: false,
      operational_balance: 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const initialPhones = (data.phones || []).map(p => ({
      company_id: companyId,
      phone_type: p.phone_type,
      raw_number: p.raw_number,
      normalized_number: normalizeCanonicalPhone(p.raw_number),
      is_primary: p.is_primary || false,
      is_verified: false,
    }));

    const created = await partyRepository.createParty(newParty, data.initialRoles || ['CUSTOMER'], initialPhones);

    // Audit log
    auditService.record({
      companyId,
      entityType: 'Party',
      entityId: created.id,
      action: 'CREATE',
      userId: userCtx.user.id,
      newValues: { name_fa: created.name_fa, party_type: created.party_type, assigned_salesperson_id: created.assigned_salesperson_id },
      reason: 'ایجاد طرف‌حساب جدید در سیستم CRM',
    });

    return { party: created };
  }

  /**
   * Updates an existing Party and audits changes (especially owner changes).
   */
  public async updateParty(
    partyId: string,
    updates: Partial<Party>,
    userCtx: SecurityContext
  ): Promise<PartyDetail> {
    const existing = await partyRepository.findPartyById(partyId);
    if (!existing) throw new Error('Party not found');

    const updated = await partyRepository.updateParty(partyId, updates);

    // Track ownership change explicitly
    if (updates.assigned_salesperson_id && updates.assigned_salesperson_id !== existing.assigned_salesperson_id) {
      partyRepository.addTimelineEvent({
        party_id: partyId,
        event_type: 'OWNER_CHANGED',
        title: 'تغییر کارشناس مسئول طرف‌حساب',
        description: `کارشناس مسئول از "${existing.assigned_salesperson_id}" به "${updates.assigned_salesperson_id}" تغییر یافت.`,
        actor_user_id: userCtx.user.id,
      });
    }

    auditService.record({
      companyId: existing.company_id,
      entityType: 'Party',
      entityId: partyId,
      action: 'UPDATE',
      userId: userCtx.user.id,
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: updated as unknown as Record<string, unknown>,
      reason: 'ویرایش مشخصات طرف‌حساب',
    });

    const fullDetail = await partyRepository.findPartyById(partyId);
    return fullDetail!;
  }

  public async getPartyById(partyId: string, userCtx: SecurityContext): Promise<PartyDetail> {
    const party = await partyRepository.findPartyById(partyId);
    if (!party) throw new Error('Party not found');

    // Scope check: If user only has OWN scope and is not owner, throw Forbidden
    const perm = PermissionGuard.can(userCtx, 'crm', 'view');
    if (perm.maxScope === 'OWN' && party.assigned_salesperson_id !== userCtx.user.id) {
      throw new Error('Access denied: You are not authorized to view this party');
    }

    return party;
  }

  public async getParties(
    companyId: string,
    filter: {
      query?: string;
      role?: PartyRoleType;
      salespersonId?: string;
      status?: string;
      includeArchived?: boolean;
      page?: number;
      limit?: number;
    },
    userCtx: SecurityContext
  ): Promise<{ items: PartyDetail[]; total: number }> {
    const perm = PermissionGuard.can(userCtx, 'crm', 'view');
    let effectiveSalespersonId = filter.salespersonId;

    if (perm.maxScope === 'OWN') {
      effectiveSalespersonId = userCtx.user.id;
    }

    return partyRepository.findParties({
      ...filter,
      companyId,
      salespersonId: effectiveSalespersonId,
    });
  }

  public async addRole(partyId: string, roleType: PartyRoleType, userCtx: SecurityContext): Promise<PartyRole> {
    const role = await partyRepository.addRole(partyId, roleType);
    auditService.record({
      companyId: userCtx.user.company_id,
      entityType: 'PartyRole',
      entityId: role.id,
      action: 'CREATE',
      userId: userCtx.user.id,
      newValues: { partyId, roleType },
      reason: `افزودن نقش ${roleType}`,
    });
    return role;
  }

  public async addPhone(
    partyId: string,
    phoneData: { phone_type: PhoneType; raw_number: string; is_primary?: boolean },
    userCtx: SecurityContext
  ): Promise<PartyPhone> {
    const canonical = normalizeCanonicalPhone(phoneData.raw_number);

    // Check duplicate
    const existing = await partyRepository.findByNormalizedPhone(userCtx.user.company_id, canonical);
    if (existing && existing.party.id !== partyId) {
      throw new Error(`این شماره قبلاً برای "${existing.party.name_fa}" ثبت شده است.`);
    }

    const phone = await partyRepository.addPhone({
      company_id: userCtx.user.company_id,
      party_id: partyId,
      phone_type: phoneData.phone_type,
      raw_number: phoneData.raw_number,
      normalized_number: canonical,
      is_primary: phoneData.is_primary || false,
      is_verified: false,
    });

    auditService.record({
      companyId: userCtx.user.company_id,
      entityType: 'PartyPhone',
      entityId: phone.id,
      action: 'CREATE',
      userId: userCtx.user.id,
      newValues: { phoneData, canonical },
      reason: 'افزودن شماره تلفن جدید',
    });

    return phone;
  }

  public async addContact(
    partyId: string,
    contactData: { full_name: string; position?: string; email?: string; is_primary?: boolean },
    phones: Array<{ phone_type: 'MOBILE' | 'DIRECT_WORK' | 'INTERNAL'; raw_number: string }>,
    userCtx: SecurityContext
  ): Promise<Contact & { phones: ContactPhone[] }> {
    const normalizedPhones = phones.map(p => ({
      phone_type: p.phone_type,
      raw_number: p.raw_number,
      normalized_number: normalizeCanonicalPhone(p.raw_number),
      is_primary: false,
    }));

    const contact = await partyRepository.addContact(
      {
        company_party_id: partyId,
        full_name: contactData.full_name,
        position: contactData.position,
        email: contactData.email,
        is_primary: contactData.is_primary || false,
      },
      normalizedPhones
    );

    auditService.record({
      companyId: userCtx.user.company_id,
      entityType: 'Contact',
      entityId: contact.id,
      action: 'CREATE',
      userId: userCtx.user.id,
      newValues: contact as unknown as Record<string, unknown>,
      reason: 'ثبت مخاطب شرکت',
    });

    return contact;
  }

  public async addAddress(
    partyId: string,
    addressData: { address_type: AddressType; province: string; city: string; postal_code?: string; address_line: string; is_default?: boolean },
    userCtx: SecurityContext
  ): Promise<Address> {
    const address = await partyRepository.addAddress({
      party_id: partyId,
      ...addressData,
      is_default: addressData.is_default || false,
    });

    auditService.record({
      companyId: userCtx.user.company_id,
      entityType: 'Address',
      entityId: address.id,
      action: 'CREATE',
      userId: userCtx.user.id,
      newValues: address as unknown as Record<string, unknown>,
      reason: 'ثبت آدرس جدید',
    });

    return address;
  }

  public async linkFinancialResponsibility(
    companyId: string,
    guarantorPartyId: string,
    guaranteedPartyId: string,
    notes: string | undefined,
    userCtx: SecurityContext
  ): Promise<FinancialResponsibility> {
    const link = await partyRepository.linkFinancialResponsibility(companyId, guarantorPartyId, guaranteedPartyId, notes);

    auditService.record({
      companyId,
      entityType: 'FinancialResponsibility',
      entityId: link.id,
      action: 'CREATE',
      userId: userCtx.user.id,
      newValues: { guarantorPartyId, guaranteedPartyId, notes },
      reason: 'اتصال ضامن مالی به طرف‌حساب',
    });

    return link;
  }

  public async getFinancialResponsibilityReport(guarantorPartyId: string): Promise<ConsolidatedResponsibilityReport> {
    return partyRepository.getFinancialResponsibilityReport(guarantorPartyId);
  }

  public async getTimeline(partyId: string): Promise<TimelineEvent[]> {
    return partyRepository.getTimelineEvents(partyId);
  }

  public async computeAndRecordCustomerScore(
    partyId: string,
    metrics: CustomerMetricsInput,
    companyScoringConfig?: CustomerScoringConfig,
    userCtx?: SecurityContext
  ): Promise<CustomerScoreResult> {
    const config = companyScoringConfig || DEFAULT_CUSTOMER_SCORING_CONFIG;
    const result = calculateCustomerScore(metrics, config);

    await partyRepository.recordScoreHistory({
      party_id: partyId,
      score_level: result.level,
      computed_score: result.score,
      metrics_snapshot: {
        operational_profit: metrics.operational_profit,
        purchased_tonnage: metrics.purchased_tonnage,
        purchase_count: metrics.purchase_count,
        total_paid: metrics.total_paid_amount,
        recency_days: metrics.recency_days,
        breakdown: result.breakdown,
      },
      effective_date: new Date().toISOString(),
    });

    if (userCtx) {
      auditService.record({
        companyId: userCtx.user.company_id,
        entityType: 'CustomerScoreHistory',
        entityId: partyId,
        action: 'UPDATE',
        userId: userCtx.user.id,
        newValues: { score: result.score, level: result.level, breakdown: result.breakdown },
        reason: 'محاسبه مجدد رتبه اعتباری مشتری بر اساس ۵ شاخص سود، تناژ، تعداد، پرداختی و تواتر',
      });
    }

    return result;
  }
}

export const crmService = new CrmService();
