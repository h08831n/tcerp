# 📋 FooladERP — Project Progress & Engineering Log

## 📌 وضعیت کلی پروژه (Status Overview)
- **معماری مرجع**: Architectural Baseline v2 (با اعمال کلیه ۸ اصلاحیه تکمیلی)
- **وضعیت فاز جاری**: **Phase 1 – Foundation (تکمیل ۱۰۰٪ موفق با ۸ تست خودکار پاس‌شده)**
- **گام بعدی**: **Phase 2 – Party & CRM Core** (مشتریان، تأمین‌کنندگان، تلفن‌های چندگانه نرمال‌شده، رتبه‌بندی، آدرس‌ها و گروه‌های مسئولیت مالی)

---

## 🏗️ ماتریس فازهای توسعه (Phase Execution Matrix)

| فاز | عنوان فاز | وضعیت | شرح اقدامات و تحویل‌ها |
| :--- | :--- | :---: | :--- |
| **Phase 1** | **Foundation & Architecture** | ✅ **تکمیل شد (Verified)** | راه‌اندازی مونو‌ریپو و کانتینرهای داکر، مایگریشن‌های 001 و 002، سیستم‌های IAM و RBAC اسکوپ‌محور، موتور شماره‌گذاری اتمیک و مقاوم در برابر همروندی (Sequences)، سیستم ذخیره‌سازی فایل با Deduplication بر مبنای هش SHA-256، دفتر ممیزی غیرقابل تغییر (AuditLog)، صف متمرکز BullMQ/Redis با پشتیبانی از کارهای زمان‌دار و Dead-Letter Queue، سرویس و تست‌های ثبت سند انتقال بین‌بانکی، بازچینی دفتر بانک و بازگردانی مانده در صورت رد ادعای مشتری. |
| **Phase 2** | **Party & CRM Core** | 🚀 **آماده شروع** | اشخاص و شرکت‌ها (Party)، تلفن‌های نرمال‌شده چندگانه (E.164)، جلوگیری از ثبت تکراری، سیستم امتیازدهی ۵ سطحی (Bronze تا VIP)، اشخاص رابط (Contacts)، آدرس‌های چندمنظوره و گروه‌های مسئولیت مالی (Guarantor). |
| **Phase 3** | **Catalog & Dynamic Attributes** | ⏳ در صف | قالب‌های کالا، واریانت‌ها، ماتریس ابعاد و سایز، مپینگ سه‌سطحی تأمین‌کننده (Variant/Template/Category)، واحدهای سنجش و تبدیل اوزان. |
| **Phase 4** | **Pricing & Multi-Channel Publishing** | ⏳ در صف | قیمت‌گذاری روزانه کارخانه‌ها، محاسبه ارزان‌ترین نرخ روزانه، صف مستقل انتشار به تلگرام، بله، ایتا، روبیکا و وب. |
| **Phase 5** | **Sales, Purchase & Allocation** | ⏳ در صف | سند مشترک پیش‌فاکتور/سفارش (SalesDocument)، قفل اقلام پس از تایید، اسناد خرید، تخصیص M:N خطوط فروش و خرید. |
| **Phase 6** | **Loading, Logistics & Stock Movement** | ⏳ در صف | ثبت LoadingLine صریح با تناژ خالص باسکول، تخصیص به سفارش‌ها، گیت امنیتی نمایش راننده در صورت بدهکاری مشتری، اسناد گردش خودکار انبار. |
| **Phase 7** | **Double-Entry Accounting & Treasury** | ⏳ در صف | کدینگ حساب‌ها، سال و دوره مالی، ثبت سند دوبل با انفاذ تعادل در تراکنش، دفتر بانک (BankStatementLine)، ادعای تسویه عملیاتی دوطرفه، انتقال بین‌بانکی با سطر کارمزد، مدیریت چک. |
| **Phase 8** | **Tax Invoices & Moadian Integration** | ⏳ در صف | فاکتورهای رسمی خرید و فروش، کالای مالیاتی، تخصیص M:N، ارسال ناهمگام به سامانه مؤدیان با ثبت کامل تاریخچه، استعلام و کارپوشه خرید. |
| **Phase 9** | **Workflow & Automation Engines** | ⏳ در صف | ماشین وضعیت عمومی، قفل فیلدها، تأییدیه‌ها، WorkflowTimer، موتور اتوماسیون با درخت شرطی، اقدامات تاخیری و کلید Idempotency. |
| **Phase 10**| **Customer Portal & Data Exchange** | ⏳ در صف | پورتال امن با نگاشت پایدار کاربر سایت، جاب‌های ایمپورت خردشده ۱۰۰۰ تایی قابل ازسرگیری (Resumable Chunked Import)، اکسپورت ناهمگام. |
| **Phase 11**| **Reports, BI & Hardening** | ⏳ در صف | ترازنامه، سود و زیان عملیاتی، گزارشات ممیزی، تست‌های فشار و اعتبارسنجی‌های نهایی. |

---

## 🧪 نتایج تست‌های خودکار فاز ۱ (Automated Test Suite Summary)
- **مجموع تست‌های اجرایی**: ۸ مورد
- **تعداد موفق (Passed)**: ۸ مورد (۱۰۰٪)
- **تعداد ناموفق (Failed)**: ۰ مورد
- **زمان کل اجرای تست‌ها**: ~۷۹ میلی‌ثانیه

1. `✅ PASS [IAM & Security]` PermissionGuard grants authorized roles and denies unprivileged users
2. `✅ PASS [Sequences]` Atomic sequence generation avoids duplicates under concurrent bursts
3. `✅ PASS [File Vault]` Uploading identical binary content physical deduplicates and reuses File record
4. `✅ PASS [Treasury & Accounting]` BankTransfer posting strictly enforces: Debit Dest X, Debit Fee F, Credit Source X+F with 2 StatementLines
5. `✅ PASS [Treasury & Accounting]` BankStatementLine reordering re-indexes deterministic sequence_no and recalculates running balance
6. `✅ PASS [Treasury & Accounting]` Posting an unbalanced JournalEntry is strictly blocked by the system
7. `✅ PASS [Treasury & Accounting]` Rejecting a customer payment claim accurately restores operational debt and records reason
8. `✅ PASS [Queue & Background Jobs]` Queue scheduler prioritizes critical jobs and routes failed jobs to Dead Letter
