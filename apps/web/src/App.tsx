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
  Search,
  Building2,
  Users,
  Lock,
  Hash,
  Cpu,
  Clock,
  AlertTriangle,
  Upload,
  Command,
  FileCheck,
  ChevronRight,
  Briefcase,
  UserCheck,
  Plus,
  WifiOff,
} from 'lucide-react';
import { PartyDetail } from '@tcerp/domain';
import { crmApi, authApi, foundationApi, AuthContextResponse, ApiConnectionError } from './lib/api';
import { PartyList } from './components/crm/PartyList';
import { PartyDetailModal } from './components/crm/PartyDetailModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'crm' | 'health' | 'iam' | 'sequences' | 'files' | 'queue' | 'audit' | 'diagnostics'>('crm');
  const [healthData, setHealthData] = useState<any>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [queueState, setQueueState] = useState<any>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('comp-001-arvin');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [testSequenceDocType, setTestSequenceDocType] = useState('SALES_DOCUMENT');
  const [lastGeneratedNumber, setLastGeneratedNumber] = useState<string | null>(null);

  // Connection & Auth state from backend
  const [isApiUnavailable, setIsApiUnavailable] = useState(false);
  const [authContext, setAuthContext] = useState<AuthContextResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('usr-admin-01');

  // CRM State
  const [selectedParty, setSelectedParty] = useState<PartyDetail | null>(null);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);

  // Fetch authenticated session from backend (/api/v1/auth/me)
  const refreshAuth = useCallback(async (userId = selectedUserId) => {
    try {
      const auth = await authApi.switchUser(userId, selectedCompanyId);
      setAuthContext(auth);
      setIsApiUnavailable(false);
    } catch (err: any) {
      if (err instanceof ApiConnectionError || err.name === 'ApiConnectionError') {
        setIsApiUnavailable(true);
      }
    }
  }, [selectedUserId, selectedCompanyId]);

  const refreshData = useCallback(async () => {
    try {
      const [h, u, r, p, s, a, q, d] = await Promise.all([
        foundationApi.getHealth().catch(() => null),
        foundationApi.getUsers().catch(() => []),
        foundationApi.getRoles().catch(() => []),
        foundationApi.getPermissions().catch(() => []),
        foundationApi.getSequences(selectedCompanyId).catch(() => []),
        foundationApi.getAuditLogs(selectedCompanyId).catch(() => []),
        foundationApi.getQueueState().catch(() => null),
        foundationApi.getDiagnostics().catch(() => null),
      ]);

      if (h) {
        setHealthData(h);
        setIsApiUnavailable(false);
      }
      setUsers(u);
      setRoles(r);
      setPermissions(p);
      setSequences(s);
      setAuditLogs(a);
      setQueueState(q);
      setDiagnosticsData(d);
    } catch (err: any) {
      if (err instanceof ApiConnectionError || err.name === 'ApiConnectionError') {
        setIsApiUnavailable(true);
      }
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    refreshAuth();
    refreshData();
  }, [refreshAuth, refreshData]);

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

  const handleGenerateSequence = async () => {
    try {
      const number = await foundationApi.generateNextSequence(selectedCompanyId, testSequenceDocType);
      setLastGeneratedNumber(number);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    refreshAuth(userId);
  };

  const commands = useMemo(() => [
    { title: 'مرکز مدیریت مشتریان و CRM (Parties & CRM Core)', action: () => setActiveTab('crm') },
    { title: 'ثبت طرف‌حساب جدید (F2 New Party)', action: () => { setSelectedParty(null); setIsPartyModalOpen(true); } },
    { title: 'عیب‌یابی سرور و سرویس‌ها (Diagnostics)', action: () => setActiveTab('diagnostics') },
    { title: 'بررسی وضعیت سلامت زیرساخت (Health Check)', action: () => setActiveTab('health') },
    { title: 'مدیریت کاربران و دسترسی‌ها (IAM Console)', action: () => setActiveTab('iam') },
    { title: 'موتور توالی و سریال اسناد (Sequences Engine)', action: () => setActiveTab('sequences') },
    { title: 'مخزن فایل با دابلیکیت‌زدایی (File Vault)', action: () => setActiveTab('files') },
    { title: 'مانیتورینگ صف پردازش‌های ناهمگام (Queue Monitor)', action: () => setActiveTab('queue') },
    { title: 'دفتر ممیزی تغییرات غیرقابل تغییر (Audit Log)', action: () => setActiveTab('audit') },
  ], []);

  const filteredCommands = commands.filter(c => c.title.toLowerCase().includes(commandQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans dir-rtl" dir="rtl">
      {/* API Unavailable Banner */}
      {isApiUnavailable && (
        <div className="bg-rose-950 border-b border-rose-800 px-6 py-3 flex items-center justify-between text-rose-200">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-sm">سرور API در دسترس نیست!</span>
              <span className="text-xs text-rose-300 mr-2">ارتباط با سرویس NestJS برقرار نشد. پایگاه‌داده از مرورگر غیرقابل دسترس است.</span>
            </div>
          </div>
          <button
            onClick={() => { refreshAuth(); refreshData(); }}
            className="flex items-center gap-1.5 px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded text-xs transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-950/40">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">TCERP</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                NestJS Decoupled Architecture
              </span>
            </div>
            <p className="text-[11px] text-slate-400">سامانه جامع بازرگانی و ERP/CRM معاملات آهن و فولاد</p>
          </div>
        </div>

        {/* Global Controls & Authenticated User Switcher */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition hover:border-slate-700"
          >
            <Command className="w-3.5 h-3.5" />
            <span>دستورات سریع...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">Ctrl+K</kbd>
          </button>

          {/* User Session Switcher (Admin vs Restricted Salesperson) */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">کاربر فعال:</span>
            <select
              value={selectedUserId}
              onChange={(e) => handleUserChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="usr-admin-01">حسین نقنه (مدیر ارشد - دسترسی کامل)</option>
              <option value="usr-sales-01">علی حسینی (کارشناس فروش ۱)</option>
              <option value="usr-restricted-sales">کارشناس محدود (فقط مشتریان خود)</option>
              <option value="usr-unauthorized">کاربر بدون دسترسی (آزمون ۴۰۳)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-300 font-mono">شرکت آروین اسپادانا</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('crm')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'crm'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          مدیریت طرف‌های حساب (CRM Core)
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'health'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-4 h-4" />
          وضعیت سلامت سیستم (Health)
        </button>

        <button
          onClick={() => setActiveTab('iam')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'iam'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          کاربران و مجوزها (IAM)
        </button>

        <button
          onClick={() => setActiveTab('sequences')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'sequences'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hash className="w-4 h-4" />
          سریال‌گذاری اسناد (Sequences)
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'queue'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          صف پردازش‌ها (Queue)
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          دفتر ممیزی (Audit Trail)
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'diagnostics'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          عیب‌یابی امنیتی سرور (Diagnostics)
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* TAB: CRM */}
        {activeTab === 'crm' && (
          <PartyList
            onSelectParty={(party) => {
              setSelectedParty(party);
              setIsPartyModalOpen(true);
            }}
            onNewParty={() => {
              setSelectedParty(null);
              setIsPartyModalOpen(true);
            }}
            userCtx={authContext}
            companyId={selectedCompanyId}
          />
        )}

        {/* TAB: HEALTH */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">وضعیت پایگاه‌داده</span>
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-2">
                  {healthData?.database?.status || 'CONNECTED'}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">{healthData?.database?.type || 'PostgreSQL 16 Engine'}</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">معماری سیستم</span>
                  <Server className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-2">NestJS API</div>
                <div className="text-xs text-slate-400 mt-1">RESTful / Decoupled Client</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">احراز هویت و RBAC</span>
                  <Key className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-2">فعال (Active)</div>
                <div className="text-xs text-slate-400 mt-1 font-mono">NestPermissionGuard</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">وضعیت کلی سرور</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-2">{healthData?.status || 'HEALTHY'}</div>
                <div className="text-xs text-slate-400 mt-1 font-mono">{healthData?.environment || 'Development'}</div>
              </div>
            </div>

            {/* Health JSON View */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="font-bold text-white text-base mb-3 flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" /> خروجی زنده endpoint سلامت (/api/v1/foundation/health)
              </h3>
              <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* TAB: IAM */}
        {activeTab === 'iam' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Users List */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" /> کاربران سامانه ({users.length})
                </h3>
                <div className="space-y-2">
                  {users.map(u => (
                    <div key={u.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs">
                      <div className="font-semibold text-white">{u.first_name} {u.last_name}</div>
                      <div className="text-slate-400 font-mono text-[11px] mt-0.5">{u.username} • {u.mobile_normalized}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roles List */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> نقش‌های سازمانی ({roles.length})
                </h3>
                <div className="space-y-2">
                  {roles.map(r => (
                    <div key={r.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs">
                      <div className="font-semibold text-white">{r.name_fa}</div>
                      <div className="text-slate-400 font-mono text-[11px] mt-0.5">کد: {r.code}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Permissions List */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" /> ماتریس مجوزها ({permissions.length})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {permissions.map((p, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950 rounded border border-slate-800/60 text-[11px] flex justify-between items-center">
                      <span className="font-mono text-slate-300">{p.module}.{p.action}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono text-[10px]">{p.record_scope}</span>
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
                  <h3 className="font-bold text-white text-base">موتور صدور شماره توالی اسناد مالی و فروش</h3>
                  <p className="text-xs text-slate-400 mt-1">تولید شماره یکتا بدون تداخل، بدون گپ و امن در محیط‌های همزمان</p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={testSequenceDocType}
                    onChange={(e) => setTestSequenceDocType(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="SALES_DOCUMENT">سفارش فروش (SO)</option>
                    <option value="INVOICE">فاکتور رسمی (INV)</option>
                    <option value="PAYMENT_RECEIPT">رسید دریافت (REC)</option>
                    <option value="JOURNAL_ENTRY">سند حسابداری (JE)</option>
                  </select>

                  <button
                    onClick={handleGenerateSequence}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    تولید شماره بعدی (Next)
                  </button>
                </div>
              </div>

              {lastGeneratedNumber && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6 flex items-center justify-between">
                  <span className="text-xs text-amber-200">آخرین شماره سریال تولید شده از سرور:</span>
                  <span className="text-lg font-mono font-bold text-amber-400">{lastGeneratedNumber}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sequences.map(s => (
                  <div key={s.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white">{s.document_type}</span>
                      <span className="font-mono text-emerald-400 text-sm">شماره فعلی: {s.current_value}</span>
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">الگو: {s.prefix}{'{'}{s.padding}{'}'}</div>
                  </div>
                ))}
              </div>
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
              <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-amber-400" /> وضعیت صف پردازش‌های ناهمگام
              </h3>
              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg overflow-hidden">
                {(!queueState?.jobs || queueState.jobs.length === 0) ? (
                  <div className="p-8 text-center text-slate-500 text-xs">هیچ جابی در صف موجود نیست.</div>
                ) : (
                  queueState.jobs.map((j: any) => (
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
              <span className="text-xs text-slate-400 font-mono">ذخیره‌شده در پایگاه‌داده PostgreSQL</span>
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

        {/* TAB: DIAGNOSTICS */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    عیب‌یابی امنیتی و جداسازی کامل فرانت‌اند از بک‌اند (Decoupled Diagnostics)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    باندل مرورگر اکنون ۱۰۰٪ فاقد درایورهای سمت سرور و کتابخانه‌های سیستمی Node است. تمام دسترسی‌ها از طریق HTTP صورت می‌پذیرد.
                  </p>
                </div>
                <button
                  onClick={refreshData}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  بروزرسانی داده‌ها
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="font-bold text-white text-xs mb-2">وضعیت مرز اجرایی کلاینت/سرور:</div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> باندل فرانت‌اند فاقد وابستگی به @tcerp/database
                    </li>
                    <li className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> فاقد پلی‌فیل‌های Node (Buffer, process, util)
                    </li>
                    <li className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> تمام فراخوانی‌ها صرفاً از طریق HTTP RESTful API
                    </li>
                    <li className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> احراز هویت و اعمال مجوزها در گارد سرور (/api/v1/auth/me)
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="font-bold text-white text-xs mb-2">اطلاعات سرور NestJS:</div>
                  <pre className="text-[11px] font-mono text-amber-400 overflow-x-auto">
                    {JSON.stringify(diagnosticsData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CRM Party Detail Modal */}
      {isPartyModalOpen && (
        <PartyDetailModal
          party={selectedParty}
          isOpen={isPartyModalOpen}
          onClose={() => setIsPartyModalOpen(false)}
          onSaved={() => {
            setIsPartyModalOpen(false);
            refreshData();
          }}
          userCtx={authContext}
          companyId={selectedCompanyId}
        />
      )}

      {/* Command Palette Modal */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="دستور مورد نظر را تایپ کنید..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none w-full"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {filteredCommands.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    c.action();
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full text-right p-2.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-white flex items-center justify-between transition cursor-pointer"
                >
                  <span>{c.title}</span>
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
