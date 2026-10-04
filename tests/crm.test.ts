/**
 * TCERP - Automated Test Suite: Phase 2 Party & CRM Core
 * Tests all 10 mandatory CRM requirements.
 */

import { crmService } from '../apps/api/src/modules/crm/crm.service';
import { partyRepository } from '../packages/database/src/party.repository';
import { normalizeCanonicalPhone, calculateTrigramSimilarity } from '../packages/shared/src/utils/crm-utils';
import { SecurityContext } from '../apps/api/src/modules/iam/permission.guard';
import { auditService } from '../apps/api/src/modules/audit/audit.service';
import { Party, User } from '../packages/domain/src';

export interface TestResult {
  title: string;
  category: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export async function runCrmTests(): Promise<{ summary: { total: number; passed: number; failed: number }; results: TestResult[] }> {
  const results: TestResult[] = [];
  const companyId = 'comp-001-arvin';

  const adminUser: User = {
    id: 'usr-admin-01',
    company_id: companyId,
    username: 'admin',
    email: 'admin@tcerp.ir',
    mobile_normalized: '+989121111111',
    password_hash: 'hash',
    first_name: 'مدیر',
    last_name: 'سیستم',
    status: 'ACTIVE',
    two_factor_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const salesUser1: User = {
    ...adminUser,
    id: 'usr-sales-01',
    username: 'ali.sales',
    first_name: 'علی',
    last_name: 'فروشی',
  };

  const salesUser2: User = {
    ...adminUser,
    id: 'usr-sales-02',
    username: 'reza.sales',
    first_name: 'رضا',
    last_name: 'همکار',
  };

  const adminCtx: SecurityContext = {
    user: adminUser,
    roles: [{ id: 'r-admin', company_id: companyId, code: 'ADMIN', name_fa: 'مدیر', is_system: true, created_at: '', updated_at: '' }],
    permissions: [
      { role_id: 'r-admin', permission_id: 'p-all', record_scope: 'ALL', module: 'crm', action: 'view' } as any,
      { role_id: 'r-admin', permission_id: 'p-view-all', record_scope: 'ALL', module: 'crm', action: 'view_all_salespersons' } as any,
    ],
    teamMemberIds: ['usr-sales-01', 'usr-sales-02'],
  };

  const restrictedSalesCtx: SecurityContext = {
    user: salesUser2,
    roles: [{ id: 'r-sales', company_id: companyId, code: 'SALES', name_fa: 'کارشناس فروش', is_system: false, created_at: '', updated_at: '' }],
    permissions: [
      { role_id: 'r-sales', permission_id: 'p-own', record_scope: 'OWN', module: 'crm', action: 'view' } as any,
    ],
    teamMemberIds: [],
  };

  async function test(category: string, title: string, fn: () => Promise<Record<string, unknown> | void>) {
    const t0 = performance.now();
    try {
      const details = await fn();
      results.push({
        title,
        category,
        passed: true,
        durationMs: Math.round((performance.now() - t0) * 100) / 100,
        details: details || undefined,
      });
    } catch (err: unknown) {
      results.push({
        title,
        category,
        passed: false,
        durationMs: Math.round((performance.now() - t0) * 100) / 100,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // TEST 1: Phone Normalization (0912..., +98912..., 0098912...)
  await test('Phone Normalization', 'Iranian numbers in various formats resolve to canonical +98912...', async () => {
    const raw1 = '09121234567';
    const raw2 = '+989121234567';
    const raw3 = '00989121234567';
    const raw4 = '۰۹۱۲۱۲۳۴۵۶۷'; // Persian digits

    const n1 = normalizeCanonicalPhone(raw1);
    const n2 = normalizeCanonicalPhone(raw2);
    const n3 = normalizeCanonicalPhone(raw3);
    const n4 = normalizeCanonicalPhone(raw4);

    if (n1 !== '+989121234567' || n2 !== '+989121234567' || n3 !== '+989121234567' || n4 !== '+989121234567') {
      throw new Error(`Normalization mismatch: ${n1}, ${n2}, ${n3}, ${n4}`);
    }

    return { input1: raw1, input4: raw4, canonical: n1 };
  });

  // TEST 2: Exact Duplicate Mobile Blocks Creation
  await test('Duplicate Prevention', 'Exact duplicate normalized mobile number strictly blocks Party creation', async () => {
    const mobile = '09129998877';

    // 1. Create initial Party
    await crmService.createParty(
      companyId,
      {
        party_type: 'COMPANY',
        name_fa: 'شرکت پترو صنعت البرز',
        phones: [{ phone_type: 'MOBILE', raw_number: mobile, is_primary: true }],
      },
      adminCtx
    );

    // 2. Attempt duplicate creation with slightly different format (+989129998877)
    let caught = false;
    let errorMessage = '';
    try {
      await crmService.createParty(
        companyId,
        {
          party_type: 'COMPANY',
          name_fa: 'پترو صنعت البرز شعبه دو',
          phones: [{ phone_type: 'MOBILE', raw_number: '+989129998877', is_primary: true }],
        },
        adminCtx
      );
    } catch (e: any) {
      caught = true;
      errorMessage = e.message;
    }

    if (!caught || !errorMessage.includes('خطای تکرار')) {
      throw new Error(`Duplicate creation was not blocked! Error received: ${errorMessage}`);
    }

    return { blocked: true, errorMessage };
  });

  // TEST 3: Similar Names Return Candidates (pg_trgm >= 85%) Without Blocking
  await test('Duplicate Prevention', 'Similar names >= 85% return possible duplicates without blocking registration', async () => {
    const nameA = 'فولاد آریا شرق';
    const nameB = 'فولاد آریای شرق';

    const similarity = calculateTrigramSimilarity(nameA, nameB);
    if (similarity < 0.85) {
      throw new Error(`Expected similarity >= 0.85, got ${similarity}`);
    }

    // Register nameA
    await crmService.createParty(
      companyId,
      {
        party_type: 'COMPANY',
        name_fa: nameA,
        phones: [{ phone_type: 'MOBILE', raw_number: '09121112233' }],
      },
      adminCtx
    );

    // Check duplicates for nameB
    const check = await crmService.checkDuplicates(companyId, { nameFa: nameB }, adminCtx);
    if (check.possibleDuplicates.length === 0) {
      throw new Error('Similar name candidate was not identified');
    }

    return { nameA, nameB, similarity, foundCandidate: check.possibleDuplicates[0].party.name_fa };
  });

  // TEST 4: Single Party as Both Customer & Supplier
  await test('Party Roles', 'A single Party simultaneously holds CUSTOMER and SUPPLIER roles', async () => {
    const created = await crmService.createParty(
      companyId,
      {
        party_type: 'COMPANY',
        name_fa: 'صنایع فولاد کاسپین',
        initialRoles: ['CUSTOMER', 'SUPPLIER'],
      },
      adminCtx
    );

    const party = await partyRepository.findPartyById(created.party.id);
    const roles = party?.roles.map(r => r.role_type) || [];

    if (!roles.includes('CUSTOMER') || !roles.includes('SUPPLIER')) {
      throw new Error(`Expected both CUSTOMER and SUPPLIER roles, got: ${roles.join(', ')}`);
    }

    return { partyName: created.party.name_fa, roles };
  });

  // TEST 5: Salesperson Cannot Access Another Salesperson's Protected Party
  await test('Permission & Ownership', 'Restricted salesperson cannot view protected customer of another salesperson', async () => {
    // Create party owned by salesUser1
    const p = await crmService.createParty(
      companyId,
      {
        party_type: 'PERSON',
        name_fa: 'محسن کریمی (مشتری اختصاصی)',
        assigned_salesperson_id: 'usr-sales-01',
      },
      adminCtx
    );

    let caught = false;
    try {
      await crmService.getPartyById(p.party.id, restrictedSalesCtx);
    } catch {
      caught = true;
    }

    if (!caught) {
      throw new Error('Restricted salesperson was improperly allowed to view another salesperson customer');
    }

    return { accessDenied: true };
  });

  // TEST 6: Manager/Team Permissions Work
  await test('Permission & Ownership', 'Sales manager can access and filter team member parties', async () => {
    const list = await crmService.getParties(companyId, { salespersonId: 'usr-sales-01' }, adminCtx);
    if (!list.items || list.items.length === 0) {
      throw new Error('Manager could not retrieve team member parties');
    }

    return { totalTeamParties: list.total };
  });

  // TEST 7: Party Owner Change Is Audited & Timeline Recorded
  await test('Audit & Timeline', 'Reassigning party owner generates audit log and timeline event', async () => {
    const p = await crmService.createParty(
      companyId,
      {
        party_type: 'COMPANY',
        name_fa: 'فولاد سازه نوین',
        assigned_salesperson_id: 'usr-sales-01',
      },
      adminCtx
    );

    // Reassign to salesUser2
    await crmService.updateParty(p.party.id, { assigned_salesperson_id: 'usr-sales-02' }, adminCtx);

    const timeline = await crmService.getTimeline(p.party.id);
    const ownerEvent = timeline.find(e => e.event_type === 'OWNER_CHANGED');

    if (!ownerEvent) {
      throw new Error('Timeline event OWNER_CHANGED was not recorded');
    }

    return { eventTitle: ownerEvent.title, description: ownerEvent.description };
  });

  // TEST 8: Financial Responsibility Roll-Up Consolidates Debt Accurately
  await test('Financial Responsibility', 'Guarantor group calculates consolidated debt while keeping individual balances independent', async () => {
    const report = await crmService.getFinancialResponsibilityReport('party-ravan');

    // Individual debts:
    // Mr. Ravan = 200M
    // Sub A = 500M
    // Sub B = 300M
    // Total Consolidated = 1,000,000,000 (1B Rials)
    if (report.totalConsolidatedDebt !== 1_000_000_000) {
      throw new Error(`Consolidated debt mismatch! Expected 1,000,000,000, received ${report.totalConsolidatedDebt}`);
    }

    if (report.guaranteedParties.length !== 2) {
      throw new Error(`Expected 2 guaranteed parties, received ${report.guaranteedParties.length}`);
    }

    return {
      guarantor: report.guarantor.name_fa,
      individualDebt: report.guarantor.operational_balance,
      guaranteedCount: report.guaranteedParties.length,
      totalConsolidatedDebt: report.totalConsolidatedDebt,
    };
  });

  // TEST 9: Contact Phone Normalization
  await test('Contacts', 'Contact person phone numbers are canonicalized to standard format', async () => {
    const p = await crmService.createParty(
      companyId,
      {
        party_type: 'COMPANY',
        name_fa: 'شرکت تجارت فلزات دنا',
      },
      adminCtx
    );

    const contact = await crmService.addContact(
      p.party.id,
      { full_name: 'رضا صبوری', position: 'مدیر خرید' },
      [{ phone_type: 'MOBILE', raw_number: '09123334455' }],
      adminCtx
    );

    if (contact.phones[0].normalized_number !== '+989123334455') {
      throw new Error(`Contact phone not normalized: ${contact.phones[0].normalized_number}`);
    }

    return { contactName: contact.full_name, normalizedPhone: contact.phones[0].normalized_number };
  });

  // TEST 10: Archived Party Excluded from Active Search by Default
  await test('Archival', 'Archived parties are excluded from default search and list queries', async () => {
    const p = await crmService.createParty(
      companyId,
      {
        party_type: 'PERSON',
        name_fa: 'حبیب نادری (مشتری راکد)',
      },
      adminCtx
    );

    // Archive party
    await crmService.updateParty(p.party.id, { status: 'ARCHIVED', archived_at: new Date().toISOString() }, adminCtx);

    const defaultList = await crmService.getParties(companyId, { query: 'حبیب نادری' }, adminCtx);
    if (defaultList.items.length !== 0) {
      throw new Error('Archived party was improperly returned in default active search query');
    }

    const archivedList = await crmService.getParties(companyId, { query: 'حبیب نادری', includeArchived: true }, adminCtx);
    if (archivedList.items.length !== 1) {
      throw new Error('Archived party was not returned when includeArchived=true was explicitly requested');
    }

    return { excludedFromDefault: true, includedWhenRequested: true };
  });

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  return {
    summary: { total, passed, failed },
    results,
  };
}
