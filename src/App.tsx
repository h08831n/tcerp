import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Database,
  Server,
  Key,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  Search,
  Building2,
  Users,
  Lock,
  Hash,
  ArrowLeftRight,
  Cpu,
  Clock,
  AlertTriangle,
  Upload,
  Command,
  FileCheck,
  ChevronRight,
  Sliders,
  DollarSign,
  Briefcase,
  UserCheck,
  Plus
} from 'lucide-react';
import { FoundationController as FoundationApiHandler, CrmController } from '@tcerp/api';
import { memoryStore, PartyDetail } from '@tcerp/database';
import { fileStorageService } from '@tcerp/api';
import { queueService } from '@tcerp/worker';
import { TestResult as FoundationTestResult } from '../tests/foundation.test';
import { runCrmTests } from '../tests/crm.test';
import { PartyList } from './components/crm/PartyList';
import { PartyDetailModal } from './components/crm/PartyDetailModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'crm' | 'health' | 'iam' | 'sequences' | 'files' | 'queue' | 'audit' | 'tests'>('crm');
  const [healthData, setHealthData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [queueState, setQueueState] = useState<any>(null);
  const [testResults, setTestResults] = useState<{ summary: any; results: any[] } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('comp-001-arvin');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [testSequenceDocType, setTestSequenceDocType] = useState('SALES_DOCUMENT');
  const [lastGeneratedNumber, setLastGeneratedNumber] = useState<string | null>(null);
  const [uploadDemoResult, setUploadDemoResult] = useState<any>(null);

  // CRM State
  const [selectedParty, setSelectedParty] = useState<PartyDetail | null>(null);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);

  const userCtx = useMemo(() => ({
    user: {
      id: 'usr-admin-01',
      company_id: selectedCompanyId,
      username: 'admin',
      first_name: 'حسین',
      last_name: 'نقنه',
    },
    roles: [{ id: 'role-admin', code: 'ADMIN' }],
    permissions: [
      { module: 'crm', action: 'view', record_scope: 'ALL' },
      { module: 'crm', action: 'view_all_salespersons', record_scope: 'ALL' },
      { module: 'sales', action: 'override_price', record_scope: 'ALL' },
    ],
    teamMemberIds: [],
  }), [selectedCompanyId]);

  const refreshData = useCallback(() => {
    setHealthData(FoundationApiHandler.getHealth().data);
    setUsers(FoundationApiHandler.getUsers().data as any[]);
    setRoles(FoundationApiHandler.getRoles().data as any[]);
    setPermissions(FoundationApiHandler.getPermissions().data as any[]);
    setSequences(FoundationApiHandler.getSequences(selectedCompanyId).data as any[]);
    setAuditLogs(FoundationApiHandler.getAuditLogs(selectedCompanyId).data as any[]);
    setQueueState(FoundationApiHandler.getQueueState().data);
  }, [selectedCompanyId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Keyboard Shortcuts: Ctrl+K for Command Palette, F2 for New Party, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setSelectedParty(null);
        setIsPartyModalOpen(true);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const runAllTests = async () => {
    setIsRunningTests(true);
    try {
      const { runFoundationTests } = await import('../tests/foundation.test');
      const [foundationRes, crmRes] = await Promise.all([
        runFoundationTests(),
        runCrmTests(),
      ]);

      setTestResults({
        summary: {
          total: foundationRes.summary.total + crmRes.summary.total,
          passed: foundationRes.summary.passed + crmRes.summary.passed,
          failed: foundationRes.summary.failed + crmRes.summary.failed,
        },
        results: [...foundationRes.results, ...crmRes.results],
      });
    } finally {
      setIsRunningTests(false);
      refreshData();
    }
  };

  const handleGenerateSequence = async () => {
    const res = await FoundationApiHandler.generateNextSequence(selectedCompanyId, testSequenceDocType);
    if (res.success && res.data) {
      setLastGeneratedNumber((res.data as any).documentNumber);
      refreshData();
    }
  };

  const handleTestUpload = async (content: string, filename: string, entityId: string) => {
    const res = await FoundationApiHandler.uploadFile({
      companyId: selectedCompanyId,
      filename,
      mimeType: 'text/plain',
      content,
      entityType: 'SalesDocument',
      entityId,
      category: 'TEST_SAMPLE',
    });
    if (res.success) {
      setUploadDemoResult(res.data);
      refreshData();
    }
  };

  const handleAddQueueJob = (priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW') => {
    queueService.enqueue({
      companyId: selectedCompanyId,
      queueName: 'notifications',
      jobType: 'DISPATCH_SMS',
      payload: { phone: '+989121234567', template: 'ORDER_CONFIRMED' },
      priority,
    });
    refreshData();
  };

  const commands = useMemo(() => [
    { title: 'مرکز مدیریت مشتریان و CRM (Parties & CRM Core)', action: () => setActiveTab('crm') },
    { title: 'ثبت طرف‌حساب جدید (F2 New Party)', action: () => { setSelectedParty(null); setIsPartyModalOpen(true); } },
    { title: 'اجرای تست‌های خودکار فاز ۱ و ۲ (19 Tests)', action: () => { setActiveTab('tests'); runAllTests(); } },
    { title: 'بررسی وضعیت زیرساخت و داکر (Health Check)', action: () => setActiveTab('health') },
    { title: 'مدیریت کاربران و دسترسی‌ها (IAM Console)', action: () => setActiveTab('iam') },
    { title: 'موتور توالی و سریال اسناد (Sequences Engine)', action: () => setActiveTab('sequences') },
    { title: 'مخزن فایل با دابلیکیت‌زدایی (File Vault)', action: () => setActiveTab('files') },
    { title: 'مانیتورینگ صف پردازش‌های ناهمگام (Queue Monitor)', action: () => setActiveTab('queue') },
    { title: 'دفتر ممیزی تغییرات غیرقابل تغییر (Audit Log)', action: () => setActiveTab('audit') },
  ], [runAllTests]);

  const filteredCommands = commands.filter(c => c.title.toLowerCase().includes(commandQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans dir-rtl" dir="rtl">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-950/40">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">TCERP</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                Phase 2: Party & CRM
              </span>
            </div>
            <p className="text-xs text-slate-400">سامانه جامع بازرگانی، CRM، معاملات، انبار و حسابداری دوبل آهن و فولاد</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Command Palette Button */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <Command className="w-3.5 h-3.5 text-amber-400" />
            <span>پالت دستورات</span>
            <kbd className="bg-slate-900 text-slate-400 text-[10px] px-1.5 py-0.5 rounded font-mono border border-slate-700">Ctrl+K</kbd>
          </button>

          {/* Run Tests Button */}
          <button
            onClick={runAllTests}
            disabled={isRunningTests}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition disabled:opacity-50 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
            <span>{isRunningTests ? 'در حال اجرا...' : 'اجرای تست‌های خودکار (۱۹ تست)'}</span>
          </button>

          <button
            onClick={refreshData}
            title="بروزرسانی داده‌ها"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 flex gap-1 overflow-x-auto text-sm">
        {[
          { id: 'crm', label: 'مرکز مشتریان و CRM', icon: UserCheck, primary: true },
          { id: 'health', label: 'سلامت زیرساخت و داکر', icon: Activity },
          { id: 'iam', label: 'کاربران و ماتریس دسترسی', icon: Users },
          { id: 'sequences', label: 'توالی و سریال اسناد', icon: Hash },
          { id: 'files', label: 'مخزن فایل با Deduplication', icon: Layers },
          { id: 'queue', label: 'صف و جاب‌های ناهمگام', icon: Cpu },
          { id: 'audit', label: 'دفتر ممیزی تغییرات', icon: Shield },
          { id: 'tests', label: 'گزارش آزمون‌های مهندسی', icon: CheckCircle2, badge: testResults?.summary.total },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition cursor-pointer ${
                isActive
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              } ${tab.primary ? 'font-bold' : ''}`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB: CRM - PARTY MANAGEMENT */}
        {activeTab === 'crm' && (
          <PartyList
            companyId={selectedCompanyId}
            userCtx={userCtx}
            onSelectParty={p => {
              setSelectedParty(p);
              setIsPartyModalOpen(true);
            }}
            onNewParty={() => {
              setSelectedParty(null);
              setIsPartyModalOpen(true);
            }}
          />
        )}

        {/* TAB: HEALTH & INFRASTRUCTURE */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">پایگاه‌داده رابطه‌ای</div>
                  <div className="text-base font-bold text-white mt-0.5">PostgreSQL 16</div>
                  <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> وضعیت: فعال و پایدار
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">کش و قفل‌های توزیع‌شده</div>
                  <div className="text-base font-bold text-white mt-0.5">Redis 7 Engine</div>
                  <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> صف BullMQ فعال
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">مخزن آبجکت S3 / MinIO</div>
                  <div className="text-base font-bold text-white mt-0.5">SHA-256 Deduplicated</div>
                  <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> باکت tcerp-files
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex items-start gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">طرف‌حساب سازمانی</div>
                  <div className="text-base font-bold text-white mt-0.5">فولاد تجارت آروین</div>
                  <div className="text-xs text-slate-400 mt-1">شناسه ملی: 10103456789</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                پیکربندی کانتینرهای توسعه محلی (TCERP Docker Stack)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" /> tcerp-postgres
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    کانتینر دیتابیس با افزونه pg_trgm برای جستجوی تشابه نام‌های بالای ۸۵٪.
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-red-400" /> tcerp-redis
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    کانتینر ردیس ۷ برای صف‌های پیامک، استعلام مؤدیان و قفل‌های همروند.
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" /> tcerp-minio
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    کانتینر ذخیره‌سازی فایل با باکت tcerp-files و الگوریتم Deduplication هش SHA-256.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: IAM & PERMISSIONS */}
        {activeTab === 'iam' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" /> کاربران سامانه ({users.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {users.map(u => (
                    <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30">
                      <div>
                        <div className="font-medium text-white text-sm">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{u.username} • {u.mobile_normalized}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.roles?.map((r: any) => (
                          <span key={r.id} className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
                            {r.name_fa}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" /> نقش‌ها و دسترسی‌ها ({roles.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {roles.map(r => (
                    <div key={r.id} className="p-4 hover:bg-slate-800/30">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{r.name_fa}</span>
                        <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{r.code}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">محدوده دسترسی: تمامی رکوردهای سازمان (ALL Scope)</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SEQUENCES */}
        {activeTab === 'sequences' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Hash className="w-5 h-5 text-amber-400" /> موتور توالی اسناد TCERP
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    تضمین عدم تکرار در همروندی بالا، قفل سطری و حفظ یکپارچگی پیش‌فاکتور و سفارش قطعی.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={testSequenceDocType}
                    onChange={e => setTestSequenceDocType(e.target.value)}
                    className="bg-slate-800 text-xs text-white border border-slate-700 rounded-lg px-3 py-2"
                  >
                    <option value="SALES_DOCUMENT">سند سفارش فروش (SD)</option>
                    <option value="PURCHASE_DOCUMENT">سند سفارش خرید (PO)</option>
                    <option value="SALES_TAX_INVOICE">فاکتور رسمی فروش (STI)</option>
                    <option value="JOURNAL_ENTRY">سند حسابداری (JE)</option>
                  </select>

                  <button
                    onClick={handleGenerateSequence}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    صدور شماره سند جدید
                  </button>
                </div>
              </div>

              {lastGeneratedNumber && (
                <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>شماره سند صادرشده:</span>
                  </div>
                  <span className="font-mono text-lg font-bold text-emerald-300 bg-slate-950 px-4 py-1.5 rounded border border-emerald-500/30">
                    {lastGeneratedNumber}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sequences.map(s => (
                  <div key={s.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{s.document_type}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        فرمت: <span className="font-mono text-amber-400">{s.prefix}-{s.year_format === 'JALALI_4' ? '1404' : 'YYYY'}-{'0'.repeat(s.padding_digits)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">چرخه ریست: {s.reset_cycle}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">آخرین شماره جاری</div>
                      <div className="text-xl font-bold font-mono text-white mt-0.5">{s.current_number}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: FILES */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                آزمون ذخیره‌سازی محتوا‌محور (Content-Addressable Deduplication)
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                سیستم با محاسبه هش SHA-256، از ذخیره فیزیکی مجدد بایت‌های تکراری در باکت tcerp-files ممانعت می‌کند.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => handleTestUpload('WEIGHBRIDGE_SLIP_WEIGHT_48500_KG_TRUCK_IR22', 'weighbridge_slip_48500.txt', 'loading-001')}
                  className="p-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-right transition"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Upload className="w-4 h-4 text-blue-400" />
                    آپلود ۱: قبض باسکول ۴۸.۵ تن (برای بارگیری ۱)
                  </div>
                  <p className="text-xs text-slate-400 mt-1">ایجاد رکورد فیزیکی جدید با هش اختصاصی در باکت tcerp-files</p>
                </button>

                <button
                  onClick={() => handleTestUpload('WEIGHBRIDGE_SLIP_WEIGHT_48500_KG_TRUCK_IR22', 'weighbridge_duplicate_copy.txt', 'sales-order-105')}
                  className="p-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-right transition"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Upload className="w-4 h-4 text-amber-400" />
                    آپلود ۲: همان قبض با نام فایل دیگر (برای سفارش فروش ۱۰۵)
                  </div>
                  <p className="text-xs text-slate-400 mt-1">تست Deduplication: عدم مصرف بایت و استفاده مجدد از فایل قبلی</p>
                </button>
              </div>

              {uploadDemoResult && (
                <div className={`p-4 rounded-xl border ${uploadDemoResult.isDeduplicated ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-amber-400" />
                      نتیجه: {uploadDemoResult.isDeduplicated ? '✅ فایل تکراری تشخیص داده شد (Deduplicated)' : '🆕 فایل جدید ذخیره شد'}
                    </span>
                    <span className="text-xs font-mono text-slate-400">حجم: {uploadDemoResult.file.size_bytes} بایت</span>
                  </div>
                  <div className="text-xs font-mono text-slate-300 break-all bg-slate-950 p-2.5 rounded border border-slate-800">
                    SHA-256 Hash: {uploadDemoResult.file.content_hash}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: QUEUE */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">جاب‌های در صف (Pending)</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{queueState?.metrics?.pending || 0}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">زمان‌بندی‌شده (Scheduled)</div>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{queueState?.metrics?.scheduled || 0}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">پردازش موفق (Succeeded)</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{queueState?.metrics?.succeeded || 0}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">صف خطاهای قطعی (Dead Letter)</div>
                <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{queueState?.metrics?.deadLetter || 0}</div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-amber-400" /> مدیریت جاب‌های ناهمگام و اولویت‌ها
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddQueueJob('CRITICAL')}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    + جاب با اولویت CRITICAL
                  </button>
                  <button
                    onClick={() => handleAddQueueJob('NORMAL')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
                  >
                    + جاب با اولویت NORMAL
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg overflow-hidden">
                {queueState?.jobs?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">هیچ جابی در صف موجود نیست.</div>
                ) : (
                  queueState?.jobs?.map((j: any) => (
                    <div key={j.id} className="p-3.5 bg-slate-950 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{j.job_type}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            j.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {j.priority}
                          </span>
                        </div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">صف: {j.queue_name} • تلاش: {j.attempt_count}/{j.max_attempts}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        j.status === 'SUCCEEDED' ? 'bg-emerald-500/20 text-emerald-400' :
                        j.status === 'FAILED' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {j.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: AUDIT */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" /> دفتر ممیزی تغییرات سیستم (TCERP Immutable Audit Trail)
              </h3>
              <span className="text-xs text-slate-400 font-mono">غیرقابل ویرایش و حذف</span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">هنوز رویداد ممیزی ثبت نشده است.</div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="p-4 hover:bg-slate-800/30">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                          log.action === 'CREATE' ? 'bg-emerald-500/20 text-emerald-400' :
                          log.action === 'UPDATE' ? 'bg-blue-500/20 text-blue-400' :
                          log.action === 'REJECT' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {log.action}
                        </span>
                        <span className="font-bold text-white">{log.entity_type}</span>
                        <span className="text-slate-400 font-mono">({log.entity_id})</span>
                      </div>
                      <span className="text-slate-500 text-[11px] font-mono">{new Date(log.created_at).toLocaleTimeString('fa-IR')}</span>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-slate-300 mt-1 bg-slate-950 p-2 rounded border border-slate-800/60">
                        علت: {log.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: AUTOMATED TESTS */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    نتایج آزمون‌های خودکار TCERP (۱۹ تست جامع فاز ۱ و ۲)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    شامل آزمون‌های نرمال‌سازی شماره، ممانعت از موبایل تکراری، تشابه نام، خزانه‌داری و تراز دوبل.
                  </p>
                </div>

                <button
                  onClick={runAllTests}
                  disabled={isRunningTests}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {isRunningTests ? 'در حال اجرا...' : 'اجرای مجدد آزمون‌ها'}
                </button>
              </div>

              {testResults && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-xs text-slate-400">تعداد کل تست‌ها</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">{testResults.summary.total}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xs text-emerald-400">موفق (Passed)</div>
                    <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{testResults.summary.passed}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="text-xs text-rose-400">ناموفق (Failed)</div>
                    <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{testResults.summary.failed}</div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {testResults?.results.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex items-start justify-between text-xs ${
                      r.passed ? 'bg-slate-950 border-slate-800' : 'bg-rose-500/10 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-white">{r.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">دسته‌بندی: {r.category}</div>
                        {r.details && (
                          <pre className="mt-2 text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 overflow-x-auto max-w-2xl">
                            {JSON.stringify(r.details, null, 2)}
                          </pre>
                        )}
                        {r.error && (
                          <div className="mt-2 text-xs text-rose-400 font-mono bg-rose-950/40 p-2 rounded border border-rose-900">
                            خطا: {r.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px] shrink-0">{r.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Party Detail & Registration Modal */}
      <PartyDetailModal
        party={selectedParty}
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        onSaved={refreshData}
        userCtx={userCtx}
        companyId={selectedCompanyId}
      />

      {/* Command Palette Modal (Ctrl+K) */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-24 px-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-3 border-b border-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="دستور یا عملیات موردنظر را جستجو کنید... (مثلاً: مشتری، تست، توالی، فایل)"
                value={commandQuery}
                onChange={e => setCommandQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              <kbd className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-mono border border-slate-700">ESC</kbd>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 divide-y divide-slate-800/40">
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    cmd.action();
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full text-right p-3 rounded-lg hover:bg-slate-800 text-xs text-slate-200 hover:text-white flex items-center justify-between transition cursor-pointer"
                >
                  <span>{cmd.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
