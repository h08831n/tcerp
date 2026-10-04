import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Save,
  Building2,
  User,
  Phone,
  MapPin,
  Users,
  Shield,
  Award,
  Clock,
  DollarSign,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { CrmController } from '@tcerp/api';
import { PartyDetail } from '@tcerp/database';
import {
  AddressType,
  ConsolidatedResponsibilityReport,
  PartyRoleType,
  PartyType,
  PhoneType,
  TimelineEvent,
} from '@tcerp/domain';
import { formatRials, normalizeCanonicalPhone } from '@tcerp/shared';

interface PartyDetailModalProps {
  party?: PartyDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  userCtx: any;
  companyId: string;
}

export const PartyDetailModal: React.FC<PartyDetailModalProps> = ({
  party,
  isOpen,
  onClose,
  onSaved,
  userCtx,
  companyId,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'phones' | 'contacts' | 'addresses' | 'roles' | 'financial' | 'score' | 'timeline'>('general');
  const [formData, setFormData] = useState({
    party_type: 'COMPANY' as PartyType,
    name_fa: '',
    name_en: '',
    national_id: '',
    economic_code: '',
    registration_number: '',
    postal_code: '',
    website: '',
    email: '',
    assigned_salesperson_id: '',
  });

  // New phone sub-form
  const [newPhone, setNewPhone] = useState({
    phone_type: 'MOBILE' as PhoneType,
    raw_number: '',
    is_primary: true,
  });

  // Timeline & Financial Responsibility
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [financialReport, setFinancialReport] = useState<ConsolidatedResponsibilityReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (party) {
      setFormData({
        party_type: party.party_type,
        name_fa: party.name_fa || '',
        name_en: party.name_en || '',
        national_id: party.national_id || '',
        economic_code: party.economic_code || '',
        registration_number: party.registration_number || '',
        postal_code: party.postal_code || '',
        website: party.website || '',
        email: party.email || '',
        assigned_salesperson_id: party.assigned_salesperson_id || '',
      });

      // Load timeline
      CrmController.getTimeline(party.id).then(res => {
        if (res.success && res.data) setTimeline(res.data as TimelineEvent[]);
      });

      // Load financial responsibility report
      CrmController.getFinancialResponsibility(party.id).then(res => {
        if (res.success && res.data) setFinancialReport(res.data as ConsolidatedResponsibilityReport);
      });
    } else {
      setFormData({
        party_type: 'COMPANY',
        name_fa: '',
        name_en: '',
        national_id: '',
        economic_code: '',
        registration_number: '',
        postal_code: '',
        website: '',
        email: '',
        assigned_salesperson_id: userCtx?.user?.id || '',
      });
      setTimeline([]);
      setFinancialReport(null);
    }
    setErrorMsg(null);
  }, [party, userCtx]);

  // Keyboard shortcut: Ctrl+S to save, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSave = async () => {
    if (!formData.name_fa.trim()) {
      setErrorMsg('نام طرف‌حساب الزامی است.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      if (party) {
        // Update
        const res = await CrmController.updateParty(party.id, formData, userCtx);
        if (!res.success) {
          throw new Error(res.error || 'خطا در ویرایش طرف‌حساب');
        }
      } else {
        // Create
        const initialPhones = newPhone.raw_number ? [newPhone] : [];
        const res = await CrmController.createParty(
          companyId,
          {
            ...formData,
            phones: initialPhones,
            initialRoles: ['CUSTOMER'],
          },
          userCtx
        );
        if (!res.success) {
          throw new Error(res.error || 'خطا در ثبت طرف‌حساب');
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPhone = async () => {
    if (!party || !newPhone.raw_number) return;
    try {
      const res = await CrmController.addPhone(party.id, newPhone, userCtx);
      if (res.success) {
        setNewPhone({ phone_type: 'MOBILE', raw_number: '', is_primary: false });
        onSaved();
      } else {
        setErrorMsg(res.error || 'خطا در ثبت شماره');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAddRole = async (roleType: PartyRoleType) => {
    if (!party) return;
    try {
      const res = await CrmController.addRole(party.id, roleType, userCtx);
      if (res.success) {
        onSaved();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              {formData.party_type === 'COMPANY' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-bold text-white text-base">
                {party ? `پرونده طرف‌حساب: ${party.name_fa}` : 'ثبت طرف‌حساب جدید'}
              </h2>
              <p className="text-xs text-slate-400">
                {party ? `شناسه سیستمی: ${party.id} • رتبه: ${party.customer_score_level}` : 'ورود مشخصات هویتی، شماره‌ها و نقش‌های تجاری'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره (Ctrl+S)'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="بستن (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="bg-rose-500/10 border-b border-rose-500/30 p-3 px-6 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 flex gap-1 overflow-x-auto text-xs">
          {[
            { id: 'general', label: 'مشخصات عمومی', icon: Building2 },
            { id: 'phones', label: `تلفن‌ها (${party?.phones?.length || 0})`, icon: Phone },
            { id: 'contacts', label: `مخاطبین (${party?.contacts?.length || 0})`, icon: Users },
            { id: 'addresses', label: `آدرس‌ها (${party?.addresses?.length || 0})`, icon: MapPin },
            { id: 'roles', label: `نقش‌ها (${party?.roles?.length || 0})`, icon: Shield },
            { id: 'financial', label: 'تعهدات مالی و ضامن', icon: DollarSign },
            { id: 'score', label: 'رتبه‌بندی و هوش تجاری', icon: Award },
            { id: 'timeline', label: 'تایم‌لاین رویدادها', icon: Clock },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 py-3 px-3 font-medium border-b-2 transition cursor-pointer ${
                  isActive
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">نوع طرف‌حساب</label>
                <select
                  value={formData.party_type}
                  onChange={e => setFormData({ ...formData, party_type: e.target.value as PartyType })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="COMPANY">حقوقی (شرکت / بنگاه / کارخانه)</option>
                  <option value="PERSON">حقیقی (شخص / تاجر / راننده)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">نام رسمی فارسی *</label>
                <input
                  type="text"
                  placeholder="مثال: شرکت فولاد تجارت آروین"
                  value={formData.name_fa}
                  onChange={e => setFormData({ ...formData, name_fa: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">نام انگلیسی / لاتین</label>
                <input
                  type="text"
                  placeholder="Arvin Steel Co."
                  value={formData.name_en}
                  onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">شناسه ملی / کد ملی</label>
                <input
                  type="text"
                  placeholder="۱۰ یا ۱۱ رقم"
                  value={formData.national_id}
                  onChange={e => setFormData({ ...formData, national_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">کد اقتصادی سازمان مالیاتی</label>
                <input
                  type="text"
                  placeholder="۱۲ رقمی"
                  value={formData.economic_code}
                  onChange={e => setFormData({ ...formData, economic_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">شماره ثبت شرکت</label>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={e => setFormData({ ...formData, registration_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">کد پستی ۱۰ رقمی</label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">کارشناس مسئول طرف‌حساب (Customer Owner)</label>
                <input
                  type="text"
                  placeholder="شناسه کارشناس مسئول"
                  value={formData.assigned_salesperson_id}
                  onChange={e => setFormData({ ...formData, assigned_salesperson_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PHONES */}
          {activeTab === 'phones' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-white mb-3">افزودن شماره تلفن جدید</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={newPhone.phone_type}
                    onChange={e => setNewPhone({ ...newPhone, phone_type: e.target.value as PhoneType })}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="MOBILE">موبایل</option>
                    <option value="WORK_PHONE">تلفن ثابت محل کار</option>
                    <option value="FAX">فکس</option>
                    <option value="OTHER">سایر</option>
                  </select>

                  <input
                    type="text"
                    placeholder="شماره (مثلاً 09121234567)"
                    value={newPhone.raw_number}
                    onChange={e => setNewPhone({ ...newPhone, raw_number: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono flex-1"
                  />

                  {party ? (
                    <button
                      onClick={handleAddPhone}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                    >
                      افزودن شماره
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">شماره اولیه با ثبت پرونده ذخیره خواهد شد.</span>
                  )}
                </div>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {party?.phones?.map(ph => (
                  <div key={ph.id} className="p-3.5 bg-slate-950 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono text-white font-semibold flex items-center gap-2">
                        <span>{ph.normalized_number}</span>
                        {ph.is_primary && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-sans">
                            شماره اصلی
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        نوع: {ph.phone_type} • ورودی کاربر: {ph.raw_number}
                      </div>
                    </div>
                    <span className="text-emerald-400 text-[11px] font-sans flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> نرمال‌شده استاندارد E.164
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white mb-2">نقش‌های تجاری طرف‌حساب</h4>
              <p className="text-xs text-slate-400 mb-4">
                یک طرف‌حساب می‌تواند همزمان مشتری و تأمین‌کننده باشد و تعهدات وی در دو سرفصل مستقل ثبت می‌شود.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { type: 'CUSTOMER', label: 'مشتری / خریدار' },
                  { type: 'SUPPLIER', label: 'تأمین‌کننده / کارخانه' },
                  { type: 'DRIVER', label: 'راننده حمل بار' },
                  { type: 'CARRIER', label: 'شرکت باربری' },
                  { type: 'PARTNER', label: 'شریک تجاری' },
                ].map(r => {
                  const hasRole = party?.roles?.some(pr => pr.role_type === r.type && pr.is_active);
                  return (
                    <button
                      key={r.type}
                      onClick={() => handleAddRole(r.type as PartyRoleType)}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                        hasRole
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{r.label}</div>
                      <div className="text-[10px] mt-1 font-mono">{hasRole ? 'فعال' : '+ افزودن'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: FINANCIAL RESPONSIBILITY */}
          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  گزارش مسئولیت مالی تجمیعی (Consolidated Responsibility Group)
                </h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  هویت طرف‌حساب‌ها مستقل است، اما بدهی‌های شرکت‌های زیرمجموعه در سرفصل ضامن تجمیع می‌گردد (مثال: گروه آقای روان).
                </p>

                {financialReport ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400">طرف‌حساب ضامن:</span>
                        <strong className="text-white mr-2">{financialReport.guarantor.name_fa}</strong>
                      </div>
                      <span className="font-mono text-amber-300">
                        بدهی انفرادی: {formatRials(financialReport.guarantor.operational_balance)}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                      <div className="p-2.5 bg-slate-900 text-slate-400 text-xs font-semibold">
                        طرف‌حساب‌های تحت ضمانت ({financialReport.guaranteedParties.length})
                      </div>
                      {financialReport.guaranteedParties.map(gp => (
                        <div key={gp.party.id} className="p-3 bg-slate-950 flex items-center justify-between text-xs">
                          <span className="text-white">{gp.party.name_fa}</span>
                          <span className="font-mono text-rose-400">بدهی مستقل: {formatRials(gp.individualDebt)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center justify-between text-sm">
                      <strong className="text-purple-300">مجموع تعهدات تجمیعی ضامن:</strong>
                      <span className="font-mono font-bold text-purple-200">
                        {formatRials(financialReport.totalConsolidatedDebt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    این طرف‌حساب در حال حاضر ضامن مالی شرکت‌های دیگر نیست.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: SCORE */}
          {activeTab === 'score' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">سطح رتبه‌بندی اعتباری مشتری</div>
                  <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {party?.customer_score_level || 'BRONZE'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">مانده حساب عملیاتی</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {formatRials(party?.operational_balance || 0)}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                رتبه‌بندی بر مبنای تناژ خریداری‌شده، سود ناخالص عملیاتی، تناوب خرید و سوابق پرداخت به صورت خودکار در ۵ سطح (Bronze تا VIP) بهینه‌سازی می‌شود.
              </div>
            </div>
          )}

          {/* TAB 8: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white mb-2">تایم‌لاین یکپارچه رویدادهای طرف‌حساب</h4>
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">هنوز رویدادی ثبت نشده است.</div>
              ) : (
                timeline.map(ev => (
                  <div key={ev.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-3 text-xs">
                    <div className="p-1.5 rounded bg-blue-500/10 text-blue-400 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-white flex items-center justify-between">
                        <span>{ev.title}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {new Date(ev.created_at).toLocaleString('fa-IR')}
                        </span>
                      </div>
                      {ev.description && <p className="text-slate-400 mt-1">{ev.description}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
