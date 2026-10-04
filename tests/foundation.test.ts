/**
 * FooladERP - Automated Test Suite: Phase 1 Foundation
 * Runs automated integration and unit tests for critical business & financial logic.
 */

import { auditService } from '../src/core/audit/audit.service';
import { PermissionGuard, SecurityContext } from '../src/core/iam/permission.guard';
import { sequenceService } from '../src/core/sequences/sequence.service';
import { fileStorageService } from '../src/core/files/storage.service';
import { queueService } from '../src/core/queue/queue.service';
import { treasuryFoundationService } from '../src/core/accounting/treasury-foundation.service';
import { BankTransfer, JournalEntry, OperationalSettlementClaim, Sequence, User } from '../src/core/types/foundation';

export interface TestResult {
  title: string;
  category: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export async function runFoundationTests(): Promise<{ summary: { total: number; passed: number; failed: number }; results: TestResult[] }> {
  const results: TestResult[] = [];
  const startAll = performance.now();

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

  // TEST 1: IAM & Granular Permissions Enforcement
  await test('IAM & Security', 'PermissionGuard grants authorized roles and denies unprivileged users', async () => {
    const adminUser: User = {
      id: 'u-admin',
      company_id: 'c-01',
      username: 'admin',
      email: 'admin@arvin.ir',
      mobile_normalized: '+989121111111',
      password_hash: 'hash',
      first_name: 'مدیر',
      last_name: 'سیستم',
      status: 'ACTIVE',
      two_factor_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const adminCtx: SecurityContext = {
      user: adminUser,
      roles: [{ id: 'r-admin', company_id: 'c-01', code: 'ADMIN', name_fa: 'مدیر', is_system: true, created_at: '', updated_at: '' }],
      permissions: [
        {
          role_id: 'r-admin',
          permission_id: 'p-override',
          record_scope: 'ALL',
          field_policy: { profit: 'EDITABLE' },
          ...({ module: 'sales', action: 'override_price' } as unknown as object),
        } as unknown as { role_id: string; permission_id: string; record_scope: 'ALL'; field_policy: Record<string, 'EDITABLE'>; module: string; action: string },
      ],
      teamMemberIds: [],
    };

    const checkAdmin = PermissionGuard.can(adminCtx, 'sales', 'override_price');
    if (!checkAdmin.allowed || checkAdmin.maxScope !== 'ALL') {
      throw new Error(`Admin check failed: ${JSON.stringify(checkAdmin)}`);
    }

    const unprivilegedCtx: SecurityContext = {
      user: { ...adminUser, id: 'u-guest' },
      roles: [],
      permissions: [],
      teamMemberIds: [],
    };

    const checkGuest = PermissionGuard.can(unprivilegedCtx, 'sales', 'override_price');
    if (checkGuest.allowed) {
      throw new Error('Unprivileged user was improperly granted sales.override_price permission');
    }

    return { adminAllowed: checkAdmin.allowed, guestDenied: !checkGuest.allowed };
  });

  // TEST 2: Concurrency-Safe Sequence Generation
  await test('Sequences', 'Atomic sequence generation avoids duplicates under concurrent bursts', async () => {
    const companyId = 'c-seq-test';
    const docType = 'SALES_DOCUMENT';

    const testSeq: Sequence = {
      id: 'seq-test-01',
      company_id: companyId,
      document_type: docType,
      prefix: 'SD',
      year_format: 'JALALI_4',
      padding_digits: 5,
      current_number: 100,
      reset_cycle: 'YEARLY_FISCAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sequenceService.registerSequence(testSeq);

    // Launch 15 concurrent calls
    const promises = Array.from({ length: 15 }, () => sequenceService.generateNextNumber(companyId, docType));
    const generated = await Promise.all(promises);

    const uniqueSet = new Set(generated);
    if (uniqueSet.size !== 15) {
      throw new Error(`Concurrency race condition detected! Generated ${generated.length} numbers but only ${uniqueSet.size} are unique.`);
    }

    if (!generated[0].startsWith('SD-') || generated.length !== 15) {
      throw new Error(`Malformed sequence output: ${generated[0]}`);
    }

    return { sampleStart: generated[0], sampleEnd: generated[generated.length - 1], totalUnique: uniqueSet.size };
  });

  // TEST 3: Content-Addressable Storage (SHA-256 Deduplication)
  await test('File Vault', 'Uploading identical binary content physical deduplicates and reuses File record', async () => {
    const fileContent = 'STEEL_PURCHASE_CONTRACT_VERSION_2026_LEGAL_APPROVED';
    const companyId = 'c-file-test';

    // Upload 1
    const upload1 = await fileStorageService.uploadAndAttach({
      companyId,
      filename: 'contract_signed_scan_1.pdf',
      mimeType: 'application/pdf',
      content: fileContent,
      entityType: 'SalesDocument',
      entityId: 'sd-001',
      category: 'CONTRACT',
    });

    if (upload1.isDeduplicated) {
      throw new Error('First upload should not be marked as deduplicated');
    }

    // Upload 2 with identical content but different filename and attached to different order
    const upload2 = await fileStorageService.uploadAndAttach({
      companyId,
      filename: 'contract_signed_scan_copy.pdf',
      mimeType: 'application/pdf',
      content: fileContent,
      entityType: 'SalesDocument',
      entityId: 'sd-002',
      category: 'CONTRACT',
    });

    if (!upload2.isDeduplicated) {
      throw new Error('Second upload with identical SHA-256 hash was not deduplicated');
    }

    if (upload1.file.id !== upload2.file.id) {
      throw new Error(`File ID mismatch: ${upload1.file.id} !== ${upload2.file.id}`);
    }

    if (upload1.attachment.id === upload2.attachment.id) {
      throw new Error('Distinct attachments must have unique IDs');
    }

    return {
      contentHash: upload1.file.content_hash,
      reusedFileId: upload1.file.id,
      attachment1: upload1.attachment.id,
      attachment2: upload2.attachment.id,
    };
  });

  // TEST 4: BankTransfer Posting Invariant (Refinement 3)
  await test('Treasury & Accounting', 'BankTransfer posting strictly enforces: Debit Dest X, Debit Fee F, Credit Source X+F with 2 StatementLines', async () => {
    const X = 500_000_000; // 500 Million Rials
    const F = 500_000;     // 500 Thousand Rials Bank Fee
    const sourceStartBalance = 1_500_000_000;
    const destStartBalance = 800_000_000;

    const transfer: BankTransfer = {
      id: 'bt-test-01',
      company_id: 'c-01',
      source_bank_account_id: 'bank-mellat',
      destination_bank_account_id: 'bank-saderat',
      transfer_amount: X,
      bank_fee: F,
      transfer_date: '2026-10-04',
      reference_number: 'TRF-987654',
      status: 'DRAFT',
      created_by_user_id: 'u-admin',
      created_at: new Date().toISOString(),
    };

    const result = treasuryFoundationService.postBankTransfer({
      companyId: 'c-01',
      transfer,
      sourceBankAccountId: 'bank-mellat',
      destinationBankAccountId: 'bank-saderat',
      sourceGlAccountId: 'gl-101001',
      destinationGlAccountId: 'gl-101002',
      bankFeeExpenseAccountId: 'gl-501001',
      sourceCurrentBalance: sourceStartBalance,
      destinationCurrentBalance: destStartBalance,
      sourceNextSequenceNo: 12,
      destinationNextSequenceNo: 8,
      userId: 'u-admin',
    });

    const lines = result.journalEntry.lines;
    if (lines.length !== 3) {
      throw new Error(`Expected exactly 3 journal lines, received ${lines.length}`);
    }

    // Verify Line 1: Debit Destination Bank = X
    const destLine = lines.find(l => l.account_id === 'gl-101002');
    if (!destLine || destLine.debit !== X || destLine.credit !== 0) {
      throw new Error(`Destination bank line incorrect: ${JSON.stringify(destLine)}`);
    }

    // Verify Line 2: Debit Bank Fee = F with default description
    const feeLine = lines.find(l => l.account_id === 'gl-501001');
    if (!feeLine || feeLine.debit !== F || feeLine.credit !== 0 || feeLine.description !== 'کارمزد انتقال وجه') {
      throw new Error(`Bank fee expense line incorrect: ${JSON.stringify(feeLine)}`);
    }

    // Verify Line 3: Credit Source Bank = X + F
    const sourceLine = lines.find(l => l.account_id === 'gl-101001');
    if (!sourceLine || sourceLine.credit !== (X + F) || sourceLine.debit !== 0) {
      throw new Error(`Source bank line incorrect: ${JSON.stringify(sourceLine)}`);
    }

    // Verify Statement Lines
    if (result.sourceStatementLine.amount !== (X + F) || result.sourceStatementLine.running_balance !== (sourceStartBalance - (X + F))) {
      throw new Error(`Source statement line balance mismatch: ${JSON.stringify(result.sourceStatementLine)}`);
    }
    if (result.destinationStatementLine.amount !== X || result.destinationStatementLine.running_balance !== (destStartBalance + X)) {
      throw new Error(`Destination statement line balance mismatch: ${JSON.stringify(result.destinationStatementLine)}`);
    }

    return {
      totalDebit: lines.reduce((s, l) => s + l.debit, 0),
      totalCredit: lines.reduce((s, l) => s + l.credit, 0),
      sourceFinalBalance: result.sourceStatementLine.running_balance,
      destFinalBalance: result.destinationStatementLine.running_balance,
    };
  });

  // TEST 5: BankStatementLine Daily Reordering & Running Balance (Refinement 1 & 2)
  await test('Treasury & Accounting', 'BankStatementLine reordering re-indexes deterministic sequence_no and recalculates running balance', async () => {
    const startBalance = 1_000_000_000;
    const lines = [
      { id: 'line-A', company_id: 'c-01', bank_account_id: 'b-01', entry_date: '2026-10-04', transaction_type: 'DEPOSIT' as const, amount: 300_000_000, description: 'واریز مشتری', source_entity_type: 'RECEIPT' as const, source_entity_id: 'rc-1', is_reconciled: false, created_at: '' },
      { id: 'line-B', company_id: 'c-01', bank_account_id: 'b-01', entry_date: '2026-10-04', transaction_type: 'WITHDRAWAL' as const, amount: 100_000_000, description: 'پرداخت به تأمین‌کننده', source_entity_type: 'PAYMENT' as const, source_entity_id: 'pm-1', is_reconciled: false, created_at: '' },
      { id: 'line-C', company_id: 'c-01', bank_account_id: 'b-01', entry_date: '2026-10-04', transaction_type: 'WITHDRAWAL' as const, amount: 50_000_000, description: 'کارمزد و هزینه‌ها', source_entity_type: 'BANK_TRANSFER' as const, source_entity_id: 'bt-1', is_reconciled: false, created_at: '' },
    ];

    // Reorder: B, then A, then C
    const reordered = treasuryFoundationService.reorderBankLines(startBalance, lines, ['line-B', 'line-A', 'line-C']);

    if (reordered[0].id !== 'line-B' || reordered[0].sequence_no !== 1 || reordered[0].running_balance !== 900_000_000) {
      throw new Error(`Step 1 mismatch: ${JSON.stringify(reordered[0])}`);
    }
    if (reordered[1].id !== 'line-A' || reordered[1].sequence_no !== 2 || reordered[1].running_balance !== 1_200_000_000) {
      throw new Error(`Step 2 mismatch: ${JSON.stringify(reordered[1])}`);
    }
    if (reordered[2].id !== 'line-C' || reordered[2].sequence_no !== 3 || reordered[2].running_balance !== 1_150_000_000) {
      throw new Error(`Step 3 mismatch: ${JSON.stringify(reordered[2])}`);
    }

    return {
      step1: { id: reordered[0].id, seq: reordered[0].sequence_no, balance: reordered[0].running_balance },
      step2: { id: reordered[1].id, seq: reordered[1].sequence_no, balance: reordered[1].running_balance },
      step3: { id: reordered[2].id, seq: reordered[2].sequence_no, balance: reordered[2].running_balance },
    };
  });

  // TEST 6: Double-Entry Balancing Enforcement
  await test('Treasury & Accounting', 'Posting an unbalanced JournalEntry is strictly blocked by the system', async () => {
    const unbalancedEntry: JournalEntry = {
      id: 'je-unbalanced',
      company_id: 'c-01',
      fiscal_year_id: 'fy-1404',
      journal_id: 'j-01',
      entry_number: 999,
      entry_date: '2026-10-04',
      document_type: 'MANUAL',
      overall_description: 'تست سند نامتعادل',
      status: 'DRAFT',
      lines: [
        { id: 'l-1', journal_entry_id: 'je-unbalanced', account_id: 'a-1', account_code: '101', account_name: 'بانک', debit: 100_000_000, credit: 0, description: 'واریز', line_order: 1 },
        { id: 'l-2', journal_entry_id: 'je-unbalanced', account_id: 'a-2', account_code: '401', account_name: 'درآمد', debit: 0, credit: 95_000_000, description: 'فروش', line_order: 2 },
      ],
      created_at: new Date().toISOString(),
    };

    let caughtError = false;
    try {
      treasuryFoundationService.enforceJournalBalance(unbalancedEntry);
    } catch {
      caughtError = true;
    }

    if (!caughtError) {
      throw new Error('Unbalanced journal entry was improperly permitted without throwing balance validation error');
    }

    return { status: 'Successfully rejected unbalanced journal entry' };
  });

  // TEST 7: OperationalSettlementClaim Rejection & Debt Restoration (Refinement 2)
  await test('Treasury & Accounting', 'Rejecting a customer payment claim accurately restores operational debt and records reason', async () => {
    const currentCustomerBalance = 300_000_000; // Customer owes 300M
    const claimedPayment = 200_000_000; // Customer claimed they paid 200M

    const claim: OperationalSettlementClaim = {
      id: 'claim-100',
      company_id: 'c-01',
      claim_direction: 'CUSTOMER_RECEIPT',
      sales_document_id: 'sd-001',
      party_id: 'party-cust-01',
      claimed_amount: claimedPayment,
      claim_date: '2026-10-04',
      payment_method: 'BANK_TRANSFER',
      status: 'UNMATCHED',
      created_by_user_id: 'u-salesperson',
      created_at: new Date().toISOString(),
    };

    // Accountant rejects claim
    const rejectionReason = 'مبلغ به حساب شرکت واریز نشده است.';
    const { updatedClaim, restoredBalance } = treasuryFoundationService.rejectClaim(
      claim,
      currentCustomerBalance,
      rejectionReason,
      'u-accountant'
    );

    if (updatedClaim.status !== 'REJECTED') {
      throw new Error(`Expected claim status to be REJECTED, received ${updatedClaim.status}`);
    }
    if (updatedClaim.rejection_reason !== rejectionReason) {
      throw new Error(`Rejection reason mismatch: ${updatedClaim.rejection_reason}`);
    }
    if (restoredBalance !== (currentCustomerBalance + claimedPayment)) {
      throw new Error(`Operational balance not accurately restored! Expected ${currentCustomerBalance + claimedPayment}, received ${restoredBalance}`);
    }

    // Record in Audit
    auditService.record({
      companyId: 'c-01',
      entityType: 'OperationalSettlementClaim',
      entityId: claim.id,
      action: 'REJECT',
      userId: 'u-accountant',
      oldValues: { status: 'UNMATCHED' },
      newValues: { status: 'REJECTED' },
      reason: rejectionReason,
    });

    return {
      claimStatus: updatedClaim.status,
      restoredDebt: restoredBalance,
      rejectionReason: updatedClaim.rejection_reason,
    };
  });

  // TEST 8: Queue Scheduling & Dead-Letter Routing
  await test('Queue & Background Jobs', 'Queue scheduler prioritizes critical jobs and routes failed jobs to Dead Letter', async () => {
    const companyId = 'c-queue-test';

    // Enqueue Low priority job
    const jobLow = queueService.enqueue({
      companyId,
      queueName: 'notifications',
      jobType: 'SMS_SEND',
      payload: { to: '+989120000000', text: 'Low priority' },
      priority: 'LOW',
    });

    // Enqueue Critical priority job
    const jobCritical = queueService.enqueue({
      companyId,
      queueName: 'notifications',
      jobType: 'MOADIAN_SUBMIT',
      payload: { invoiceId: 'inv-001' },
      priority: 'CRITICAL',
    });

    // Poll next job - CRITICAL must come first
    const firstPolled = queueService.pollNextJob('notifications');
    if (!firstPolled || firstPolled.id !== jobCritical.id) {
      throw new Error(`Expected critical job ${jobCritical.id} to be polled first, received ${firstPolled?.id}`);
    }

    // Simulate failure up to max attempts
    queueService.failJob(firstPolled.id, 'Connection timeout');
    firstPolled.attempt_count = firstPolled.max_attempts; // fast-forward to limit
    queueService.failJob(firstPolled.id, 'Final failure reached');

    const allJobs = queueService.getAllJobs();
    const deadJob = allJobs.find(j => j.id === jobCritical.id);
    if (!deadJob || !deadJob.is_dead_letter || deadJob.status !== 'FAILED') {
      throw new Error(`Job was not marked as Dead Letter: ${JSON.stringify(deadJob)}`);
    }

    return {
      polledFirstPriority: firstPolled.priority,
      deadLetterConfirmed: deadJob.is_dead_letter,
      lastError: deadJob.last_error,
    };
  });

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  return {
    summary: { total, passed, failed },
    results,
  };
}
