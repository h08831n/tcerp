import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  Download,
  Upload,
  UserCheck,
  Building2,
  User,
  Phone,
  Shield,
  Layers,
  Award,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { CrmController } from '@tcerp/api';
import { PartyDetail } from '@tcerp/database';
import { PartyRoleType } from '@tcerp/domain';
import { formatRials } from '@tcerp/shared';

interface PartyListProps {
  onSelectParty: (party: PartyDetail) => void;
  onNewParty: () => void;
  userCtx: any;
  companyId: string;
}

export const PartyList: React.FC<PartyListProps> = ({
  onSelectParty,
  onNewParty,
  userCtx,
  companyId,
}) => {
  const [parties, setParties] = useState<PartyDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<PartyRoleType | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const loadParties = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await CrmController.getParties({
        companyId,
        query: query.trim() || undefined,
        role: (roleFilter as PartyRoleType) || undefined,
        status: statusFilter || undefined,
        page,
        limit,
        userCtx,
      });
      if (res.success && res.data) {
        setParties(res.data as PartyDetail[]);
        setTotal(res.meta?.total as number || 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [companyId, query, roleFilter, statusFilter, page, limit, userCtx]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  // Keyboard navigation inside DataGrid (ArrowUp, ArrowDown, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input is focused
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, parties.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (parties[selectedIndex]) {
          e.preventDefault();
          onSelectParty(parties[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [parties, selectedIndex, onSelectParty]);

  const scoreBadgeStyles: Record<string, string> = {
    VIP: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    PLATINUM: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    GOLD: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    SILVER: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
    BRONZE: 'bg-orange-800/20 text-orange-300 border-orange-700/30',
  };

  return (
    <div className="space-y-4">
      {/* Action Header & Search Bar */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو بر اساس نام، شناسه ملی، شماره تلفن، کد اقتصادی..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 rounded-lg pr-9 pl-4 py-2.5 outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => {
              setRoleFilter(e.target.value as any);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2.5 outline-none"
          >
            <option value="">همه نقش‌ها (مشتری، تأمین‌کننده...)</option>
            <option value="CUSTOMER">خریدار / مشتری</option>
            <option value="SUPPLIER">تأمین‌کننده / کارخانه</option>
            <option value="DRIVER">راننده</option>
            <option value="CARRIER">باربری</option>
            <option value="PARTNER">شریک تجاری</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2.5 outline-none"
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="ACTIVE">فعال</option>
            <option value="INACTIVE">غیرفعال</option>
            <option value="BLOCKED">مسدود</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNewParty}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت طرف‌حساب جدید (F2)</span>
          </button>
        </div>
      </div>

      {/* High-Density DataGrid */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">ردیف</th>
                <th className="py-3.5 px-4">نام طرف‌حساب</th>
                <th className="py-3.5 px-4">نوع</th>
                <th className="py-3.5 px-4">نقش‌های فعال</th>
                <th className="py-3.5 px-4">شماره‌های تماس</th>
                <th className="py-3.5 px-4">شناسه / کد ملی</th>
                <th className="py-3.5 px-4">رتبه مشتری</th>
                <th className="py-3.5 px-4 text-left">مانده حساب جاری</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {parties.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs font-sans">
                    {isLoading ? 'در حال بارگذاری اطلاعات...' : 'هیچ طرف‌حسابی با این مشخصات یافت نشد.'}
                  </td>
                </tr>
              ) : (
                parties.map((p, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        setSelectedIndex(idx);
                        onSelectParty(p);
                      }}
                      className={`cursor-pointer transition ${
                        isSelected ? 'bg-amber-500/10 border-r-2 border-r-amber-500 text-white' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-4 text-center text-slate-500">{idx + 1 + (page - 1) * limit}</td>
                      <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                        {p.party_type === 'COMPANY' ? (
                          <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span>{p.name_fa}</span>
                        {p.risk_flag && (
                          <span className="p-0.5 rounded bg-rose-500/20 text-rose-400" title="دارای ریسک مالی">
                            <AlertCircle className="w-3 h-3" />
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-400">
                        {p.party_type === 'COMPANY' ? 'حقوقی / شرکت' : 'حقیقی / شخص'}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex flex-wrap gap-1">
                          {p.roles?.map(r => (
                            <span
                              key={r.id}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                r.role_type === 'CUSTOMER' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                r.role_type === 'SUPPLIER' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                                'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {r.role_type === 'CUSTOMER' ? 'مشتری' :
                               r.role_type === 'SUPPLIER' ? 'تأمین‌کننده' :
                               r.role_type === 'DRIVER' ? 'راننده' :
                               r.role_type === 'CARRIER' ? 'باربری' : r.role_type}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {p.phones && p.phones.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{p.phones[0].normalized_number}</span>
                            {p.phones.length > 1 && (
                              <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
                                +{p.phones.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 font-sans">ثبت‌نشده</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{p.national_id || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${scoreBadgeStyles[p.customer_score_level] || scoreBadgeStyles.BRONZE}`}>
                          {p.customer_score_level}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-left font-bold font-sans">
                        <span className={p.operational_balance > 0 ? 'text-rose-400' : p.operational_balance < 0 ? 'text-emerald-400' : 'text-slate-400'}>
                          {formatRials(p.operational_balance)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onSelectParty(p);
                          }}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                          title="مشاهده پرونده کامل"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* DataGrid Footer with Pagination & Keyboard Hint */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>مجموع طرف‌حساب‌ها: <strong className="text-white font-mono">{total}</strong></span>
            <span className="text-slate-600">|</span>
            <span className="text-[11px] text-slate-500 font-sans">
              کلیدهای ناوبری: <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800">↑</kbd> <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800">↓</kbd> انتخاب سطر، <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Enter</kbd> بازکردن پرونده
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs px-2 text-white">صفحه {page} از {Math.max(1, Math.ceil(total / limit))}</span>
            <button
              onClick={() => setPage(prev => prev + 1)}
              disabled={page >= Math.ceil(total / limit)}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
