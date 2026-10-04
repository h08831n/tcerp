# 📋 TCERP — Project Progress & Engineering Log

## 📌 وضعیت کلی پروژه (Status Overview)
- **معماری مرجع**: Architectural Baseline v2 (با اعمال کلیه ۸ اصلاحیه تکمیلی)
- **وضعیت فاز جاری**: **Phase 2 – Party & CRM Core (تکمیل ۱۰۰٪ موفق با احراز ماندگاری کامل در PostgreSQL و ۲۹ تست خودکار پاس‌شده)**
- **گام بعدی**: **Phase 3 – Catalog & Dynamic Attributes** (قالب‌های کالا، واریانت‌ها، ماتریس ابعاد و سایز، مپینگ سه‌سطحی تأمین‌کننده، واحدهای سنجش و تبدیل اوزان)

---

## 🏗️ ماتریس فازهای توسعه (Phase Execution Matrix)

| فاز | عنوان فاز | وضعیت | شرح اقدامات و تحویل‌ها |
| :--- | :--- | :---: | :--- |
| **Phase 1** | **Foundation & Architecture** | ✅ **تکمیل شد (Verified)** | راه‌اندازی مونو‌ریپو و کانتینرهای داکر، مایگریشن‌های 001 و 002، سیستم‌های IAM و RBAC اسکوپ‌محور، موتور شماره‌گذاری اتمیک و مقاوم در برابر همروندی (Sequences)، سیستم ذخیره‌سازی فایل با Deduplication بر مبنای هش SHA-256، دفتر ممیزی غیرقابل تغییر (AuditLog)، صف متمرکز BullMQ/Redis با پشتیبانی از کارهای زمان‌دار و Dead-Letter Queue، سرویس و تست‌های ثبت سند انتقال بین‌بانکی، بازچینی دفتر بانک و بازگردانی مانده در صورت رد ادعای مشتری. |
| **Phase 2** | **Party & CRM Core** | ✅ **تکمیل شد (Verified)** | بازطراحی کامل مخزن داده به PostgreSQL (`PostgresPartyRepository`) با مدیریت تراکنش‌های اتمیک (`BEGIN`/`COMMIT`/`ROLLBACK`)، انفاذ یکتایی شماره همراه در سطح پایگاه‌داده (کد خطای ۲۳۵۰۵) و آزمون همروندی همزمان، جستجوی تشابه نام با کوئری‌های واقعی `pg_trgm` در SQL، نرمال‌سازی شماره‌ها با پشتیبانی ارقام فارسی/عربی و استانداردهای ایران و بین‌الملل، سیستم امتیازدهی پویا با ۵ شاخص وزن‌دار (سود عملیاتی، تناژ خرید، تعداد فاکتور، جمع پرداختی، تواتر/تاخر)، پشتیبانی از چندنقشی همزمان (Customer و Supplier)، گروه‌های مسئولیت مالی (Guarantor) با محاسبه مانده تجمیعی، ثبت Timeline رویدادها، آرشیو منطقی و عدم اتکا به حافظه در تولید. |
| **Phase 3** | **Catalog & Dynamic Attributes** | 🚀 **آماده شروع** | قالب‌های کالا، واریانت‌ها، ماتریس ابعاد و سایز، مپینگ سه‌سطحی تأمین‌کننده (Variant/Template/Category)، واحدهای سنجش و تبدیل اوزان. |
| **Phase 4** | **Pricing & Multi-Channel Publishing** | ⏳ در صف | قیمت‌گذاری روزانه کارخانه‌ها، محاسبه ارزان‌ترین نرخ روزانه، صف مستقل انتشار به تلگرام، بله، ایتا، روبیکا و وب. |
| **Phase 5** | **Sales, Purchase & Allocation** | ⏳ در صف | سند مشترک پیش‌فاکتور/سفارش (SalesDocument)، قفل اقلام پس از تایید، اسناد خرید، تخصیص M:N خطوط فروش و خرید. |
| **Phase 6** | **Loading, Logistics & Stock Movement** | ⏳ در صف | ثبت LoadingLine صریح با تناژ خالص باسکول، تخصیص به سفارش‌ها، گیت امنیتی نمایش راننده در صورت بدهکاری مشتری، اسناد گردش خودکار انبار. |
| **Phase 7** | **Double-Entry Accounting & Treasury** | ⏳ در صف | کدینگ حساب‌ها، سال و دوره مالی، ثبت سند دوبل با انفاذ تعادل در تراکنش، دفتر بانک (BankStatementLine)، ادعای تسویه عملیاتی دوطرفه، انتقال بین‌بانکی با سطر کارمزد، مدیریت چک. |
| **Phase 8** | **Tax Invoices & Moadian Integration** | ⏳ در صف | فاکتورهای رسمی خرید و فروش، کالای مالیاتی، تخصیص M:N، ارسال ناهمگام به سامانه مؤدیان با ثبت کامل تاریخچه، استعلام و کارپوشه خرید. |
| **Phase 9** | **Workflow & Automation Engines** | ⏳ در صف | ماشین وضعیت عمومی، قفل فیلدها، تأییدیه‌ها، WorkflowTimer، موتور اتوماسیون با درخت شرطی، اقدامات تاخیری و کلید Idempotency. |
| **Phase 10**| **Customer Portal & Data Exchange** | ⏳ در صف | پورتال امن با نگاشت پایدار کاربر سایت، جاب‌های ایمپورت خردشده ۱۰۰۰ تایی قابل ازسرگیری (Resumable Chunked Import)، اکسپورت ناهمگام. |
| **Phase 11**| **Reports, BI & Hardening** | ⏳ در صف | ترازنامه، سود و زیان عملیاتی، گزارشات ممیزی، تست‌های فشار و اعتبارسنجی‌های نهایی. |

---

## 🧪 نتایج تست‌های خودکار جامع سیستم (Automated Test Suite Summary)
- **مجموع تست‌های اجرایی**: ۲۹ مورد
- **تعداد موفق (Passed)**: ۲۹ مورد (۱۰۰٪)
- **تعداد ناموفق (Failed)**: ۰ مورد

### بخش ۱ — فاز ۱ Foundation (۹ تست)
1. `✅ PASS [IAM & Security]` PermissionGuard grants authorized roles and denies unprivileged users
2. `✅ PASS [Sequences]` Atomic sequence generation avoids duplicates under concurrent bursts
3. `✅ PASS [File Vault]` Uploading identical binary content physical deduplicates and reuses File record
4. `✅ PASS [Treasury & Accounting]` BankTransfer posting strictly enforces: Debit Dest X, Debit Fee F, Credit Source X+F with 2 StatementLines
5. `✅ PASS [Treasury & Accounting]` BankStatementLine reordering re-indexes deterministic sequence_no and recalculates running balance
6. `✅ PASS [Treasury & Accounting]` Posting an unbalanced JournalEntry is strictly blocked by the system
7. `✅ PASS [Treasury & Accounting]` Rejecting a customer payment claim accurately restores operational debt and records reason
8. `✅ PASS [Queue & Background Jobs]` Queue scheduler prioritizes critical jobs and routes failed jobs to Dead Letter
9. `✅ PASS [Configuration & Security]` External secrets (SMS, Moadian, Telegram) are optional in local development

### بخش ۲ — فاز ۲ CRM Application Core (۱۰ تست)
10. `✅ PASS [Phone Normalization]` Iranian numbers in various formats resolve to canonical +98912...
11. `✅ PASS [Duplicate Prevention]` Exact duplicate normalized mobile number strictly blocks Party creation
12. `✅ PASS [Duplicate Prevention]` Similar names >= 85% return possible duplicates without blocking registration
13. `✅ PASS [Party Roles]` A single Party simultaneously holds CUSTOMER and SUPPLIER roles
14. `✅ PASS [Permission & Ownership]` Restricted salesperson cannot view protected customer of another salesperson
15. `✅ PASS [Permission & Ownership]` Sales manager can access and filter team member parties
16. `✅ PASS [Audit & Timeline]` Reassigning party owner generates audit log and timeline event
17. `✅ PASS [Financial Responsibility]` Guarantor group calculates consolidated debt while keeping individual balances independent
18. `✅ PASS [Contacts]` Contact person phone numbers are canonicalized to standard format
19. `✅ PASS [Archival]` Archived parties are excluded from default search and list queries

### بخش ۳ — فاز ۲ PostgreSQL CRM Integration Tests (۱۰ تست)
20. `✅ PASS [Phone Normalization]` Iranian formats & international E.164 resolve to canonical numbers while rejecting invalid prefixes
21. `✅ PASS [PostgreSQL Persistence]` Party creation executes atomic transaction committing party, roles, phones, contacts & addresses
22. `✅ PASS [Duplicate Prevention]` Database-level unique constraint on (company_id, normalized_number) blocks duplicate and rolls back
23. `✅ PASS [Concurrent Safety]` Concurrent duplicate inserts result in exactly one successful commit and rollback for the other
24. `✅ PASS [pg_trgm Similarity]` PostgreSQL similarity(name_fa, $1) query detects name variations above threshold (>= 85%)
25. `✅ PASS [Multi-Role Persistence]` A single Party simultaneously persists and queries both CUSTOMER and SUPPLIER roles in PostgreSQL
26. `✅ PASS [Financial Responsibility]` Guarantor group calculates consolidated debt across subsidiaries while maintaining individual balances
27. `✅ PASS [Dynamic Customer Scoring]` Customer scoring computes tier level from profit, tonnage, count, paid amount & recency based on company rules
28. `✅ PASS [Logical Archival]` Archived parties are excluded from default list queries and included only when explicitly requested
29. `✅ PASS [Persistence After Restart]` Reinitializing the repository instance against PostgreSQL retains all parties, roles, and contacts
