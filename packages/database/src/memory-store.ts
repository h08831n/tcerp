/**
 * FooladERP - In-Memory Stateful Repository & Seed Store
 * Holds initial seeds and live transactional state for Phase 1 testing and API execution.
 */

import {
  BankStatementLine,
  BankTransfer,
  Company,
  FileAttachment,
  FileRecord,
  JournalEntry,
  OperationalSettlementClaim,
  Permission,
  Role,
  RolePermission,
  Sequence,
  Setting,
  Team,
  User,
} from '@foolad/domain';

export class MemoryStore {
  public companies: Map<string, Company> = new Map();
  public users: Map<string, User> = new Map();
  public roles: Map<string, Role> = new Map();
  public permissions: Map<string, Permission> = new Map();
  public rolePermissions: RolePermission[] = [];
  public userRoles: Map<string, string[]> = new Map(); // userId -> roleIds
  public teams: Map<string, Team> = new Map();
  public sequences: Map<string, Sequence> = new Map();
  public settings: Map<string, Setting> = new Map();
  public files: Map<string, FileRecord> = new Map();
  public fileAttachments: FileAttachment[] = [];
  public bankAccounts: Map<string, { id: string; bank_name: string; account_number: string; balance: number }> = new Map();
  public bankStatementLines: BankStatementLine[] = [];
  public bankTransfers: BankTransfer[] = [];
  public journalEntries: JournalEntry[] = [];
  public operationalClaims: OperationalSettlementClaim[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const companyId = 'comp-001-arvin';
    const adminRoleId = 'role-admin';
    const salesMgrRoleId = 'role-sales-mgr';
    const accountantRoleId = 'role-chief-accountant';

    // 1. Company
    const company: Company = {
      id: companyId,
      code: 'ARVIN-STEEL',
      name_fa: 'شرکت فولاد تجارت آروین (سهامی خاص)',
      name_en: 'Arvin Steel Trading Co.',
      national_id: '10103456789',
      economic_code: '411567891234',
      registration_number: '456789',
      postal_code: '1998765432',
      phone: '021-88997766',
      email: 'info@arvinsteel.ir',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.companies.set(company.id, company);

    // 2. Roles
    const roles: Role[] = [
      { id: adminRoleId, company_id: companyId, code: 'ADMIN', name_fa: 'مدیر ارشد سیستم', is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: salesMgrRoleId, company_id: companyId, code: 'SALES_MANAGER', name_fa: 'مدیر فروش و بازرگانی', is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: accountantRoleId, company_id: companyId, code: 'ACCOUNTANT', name_fa: 'رئیس حسابداری و مالی', is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    roles.forEach(r => this.roles.set(r.id, r));

    // 3. Permissions
    const permissions: Permission[] = [
      { id: 'perm-sales-view', module: 'sales', action: 'view', name_fa: 'مشاهده سفارشات فروش', is_sensitive: false },
      { id: 'perm-sales-confirm', module: 'sales', action: 'confirm', name_fa: 'تأیید پیش‌فاکتور به سفارش', is_sensitive: false },
      { id: 'perm-sales-override', module: 'sales', action: 'override_price', name_fa: 'تغییر قیمت سفارش قفل‌شده (مدیر)', is_sensitive: true },
      { id: 'perm-treasury-adjust', module: 'treasury', action: 'bank_adjustment', name_fa: 'ثبت تعدیل موجودی بانک', is_sensitive: true },
      { id: 'perm-accounting-post', module: 'accounting', action: 'post', name_fa: 'ثبت قطعی سند حسابداری', is_sensitive: true },
      { id: 'perm-files-upload', module: 'files', action: 'upload', name_fa: 'آپلود و مدیریت فایل', is_sensitive: false },
      { id: 'perm-queue-manage', module: 'queue', action: 'manage', name_fa: 'مدیریت صف‌ها و جاب‌های ناموفق', is_sensitive: true },
    ];
    permissions.forEach(p => this.permissions.set(p.id, p));

    // Role Permissions
    permissions.forEach(p => {
      this.rolePermissions.push({
        role_id: adminRoleId,
        permission_id: p.id,
        record_scope: 'ALL',
        field_policy: {},
      });
    });

    // 4. Users
    const adminUser: User = {
      id: 'usr-admin-01',
      company_id: companyId,
      username: 'admin',
      email: 'admin@arvinsteel.ir',
      mobile_normalized: '+989121111111',
      password_hash: 'scrypt_argon2_mock_hash',
      first_name: 'حسین',
      last_name: 'نقنه',
      status: 'ACTIVE',
      two_factor_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const accountantUser: User = {
      id: 'usr-acc-01',
      company_id: companyId,
      username: 'm.ahmadi',
      email: 'ahmadi@arvinsteel.ir',
      mobile_normalized: '+989122222222',
      password_hash: 'scrypt_argon2_mock_hash',
      first_name: 'محمد',
      last_name: 'احمدی',
      status: 'ACTIVE',
      two_factor_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.set(adminUser.id, adminUser);
    this.users.set(accountantUser.id, accountantUser);
    this.userRoles.set(adminUser.id, [adminRoleId]);
    this.userRoles.set(accountantUser.id, [accountantRoleId]);

    // 5. Sequences
    const sequences: Sequence[] = [
      { id: 'seq-sales', company_id: companyId, document_type: 'SALES_DOCUMENT', prefix: 'SD', year_format: 'JALALI_4', padding_digits: 5, current_number: 104, reset_cycle: 'YEARLY_FISCAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'seq-purchase', company_id: companyId, document_type: 'PURCHASE_DOCUMENT', prefix: 'PO', year_format: 'JALALI_4', padding_digits: 5, current_number: 48, reset_cycle: 'YEARLY_FISCAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'seq-tax-inv', company_id: companyId, document_type: 'SALES_TAX_INVOICE', prefix: 'STI', year_format: 'JALALI_4', padding_digits: 5, current_number: 22, reset_cycle: 'YEARLY_FISCAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'seq-journal', company_id: companyId, document_type: 'JOURNAL_ENTRY', prefix: 'JE', year_format: 'JALALI_4', padding_digits: 6, current_number: 512, reset_cycle: 'YEARLY_FISCAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    sequences.forEach(s => this.sequences.set(s.id, s));

    // 6. Bank Accounts
    this.bankAccounts.set('bank-mellat', {
      id: 'bank-mellat',
      bank_name: 'بانک ملت - شعبه مرکزی',
      account_number: '4822998811',
      balance: 14_500_000_000,
    });
    this.bankAccounts.set('bank-saderat', {
      id: 'bank-saderat',
      bank_name: 'بانک صادرات - شعبه بازار آهن',
      account_number: '0102998877001',
      balance: 8_200_000_000,
    });
  }
}

export const memoryStore = new MemoryStore();
