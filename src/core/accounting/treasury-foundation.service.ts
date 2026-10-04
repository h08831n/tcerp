/**
 * FooladERP - Treasury & Accounting Foundation Service
 * Implements critical financial invariants:
 * 1. BankStatementLine daily reordering & running balance recalculation
 * 2. Exact BankTransfer posting: Debit Dest X, Debit Fee F, Credit Source X+F with 2 StatementLines
 * 3. Double-entry balance enforcement: SUM(Debit) == SUM(Credit) in posting transaction
 * 4. OperationalSettlementClaim rejection & debt restoration
 */

import { BankStatementLine, BankTransfer, JournalEntry, JournalLine, OperationalSettlementClaim } from '../types/foundation';

export class TreasuryFoundationService {
  /**
   * Reorders bank statement lines for a specific bank and date, re-indexing sequence_no (1, 2, 3...)
   * and accurately recalculating running balances from starting balance.
   */
  public reorderBankLines(
    startingBalance: number,
    lines: Array<Omit<BankStatementLine, 'sequence_no' | 'running_balance'>>,
    orderIds: string[]
  ): BankStatementLine[] {
    // Sort according to provided reorder IDs
    const lineMap = new Map(lines.map(l => [l.id, l]));
    const ordered: Array<Omit<BankStatementLine, 'sequence_no' | 'running_balance'>> = [];

    for (const id of orderIds) {
      const line = lineMap.get(id);
      if (line) {
        ordered.push(line);
      }
    }

    // Include any lines not explicitly mentioned in orderIds
    for (const line of lines) {
      if (!orderIds.includes(line.id)) {
        ordered.push(line);
      }
    }

    let currentBalance = startingBalance;
    const result: BankStatementLine[] = [];

    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i];
      const seqNo = i + 1;

      if (item.transaction_type === 'DEPOSIT') {
        currentBalance += item.amount;
      } else {
        currentBalance -= item.amount;
      }

      result.push({
        ...item,
        sequence_no: seqNo,
        running_balance: Math.round(currentBalance * 100) / 100,
      });
    }

    return result;
  }

  /**
   * Posts a BankTransfer adhering strictly to accounting standards:
   * Transfer amount = X, Fee = F
   * Line 1: Debit Destination Bank = X
   * Line 2: Debit Bank Fee Expense = F
   * Line 3: Credit Source Bank = X + F
   * And generates 2 independent BankStatementLines for Source and Destination accounts.
   */
  public postBankTransfer(params: {
    companyId: string;
    transfer: BankTransfer;
    sourceBankAccountId: string;
    destinationBankAccountId: string;
    sourceGlAccountId: string;
    destinationGlAccountId: string;
    bankFeeExpenseAccountId: string;
    sourceCurrentBalance: number;
    destinationCurrentBalance: number;
    sourceNextSequenceNo: number;
    destinationNextSequenceNo: number;
    userId: string;
  }): {
    journalEntry: JournalEntry;
    sourceStatementLine: BankStatementLine;
    destinationStatementLine: BankStatementLine;
  } {
    const X = params.transfer.transfer_amount;
    const F = params.transfer.bank_fee;
    const totalDeducted = X + F;

    const journalEntryId = crypto.randomUUID();
    const journalLines: JournalLine[] = [];

    // Line 1: Debit Destination Bank Account (X)
    journalLines.push({
      id: crypto.randomUUID(),
      journal_entry_id: journalEntryId,
      account_id: params.destinationGlAccountId,
      account_code: '101002',
      account_name: 'بانک مقصد',
      debit: X,
      credit: 0,
      description: `انتقال وجه بین بانکی - واریز به حساب مقصد بابت حواله ${params.transfer.reference_number || ''}`.trim(),
      line_order: 1,
    });

    // Line 2: Debit Bank Fee Expense Account (F) (if fee > 0)
    if (F > 0) {
      journalLines.push({
        id: crypto.randomUUID(),
        journal_entry_id: journalEntryId,
        account_id: params.bankFeeExpenseAccountId,
        account_code: '501001',
        account_name: 'هزینه کارمزد بانکی',
        debit: F,
        credit: 0,
        description: 'کارمزد انتقال وجه', // Default standard description template
        line_order: 2,
      });
    }

    // Line 3: Credit Source Bank Account (X + F)
    journalLines.push({
      id: crypto.randomUUID(),
      journal_entry_id: journalEntryId,
      account_id: params.sourceGlAccountId,
      account_code: '101001',
      account_name: 'بانک مبدأ',
      debit: 0,
      credit: totalDeducted,
      description: `انتقال وجه بین بانکی - برداشت از حساب مبدأ بابت حواله ${params.transfer.reference_number || ''}`.trim(),
      line_order: F > 0 ? 3 : 2,
    });

    // Enforce Double-entry balance
    const totalDebit = journalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = journalLines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Double-entry balance violation: Total Debit (${totalDebit}) does not equal Total Credit (${totalCredit})`);
    }

    const journalEntry: JournalEntry = {
      id: journalEntryId,
      company_id: params.companyId,
      fiscal_year_id: 'FY-1404',
      journal_id: 'JRNL-TREASURY',
      entry_number: 105,
      entry_date: params.transfer.transfer_date,
      document_type: 'BANK_TRANSFER',
      overall_description: `انتقال بین‌بانکی مبلغ ${X.toLocaleString('fa-IR')} ریال با کارمزد ${F.toLocaleString('fa-IR')} ریال`,
      status: 'POSTED',
      lines: journalLines,
      created_at: new Date().toISOString(),
      created_by: params.userId,
      posted_at: new Date().toISOString(),
      posted_by: params.userId,
    };

    // BankStatementLine 1: Source Bank Withdrawal (X + F)
    const sourceStatementLine: BankStatementLine = {
      id: crypto.randomUUID(),
      company_id: params.companyId,
      bank_account_id: params.sourceBankAccountId,
      entry_date: params.transfer.transfer_date,
      sequence_no: params.sourceNextSequenceNo,
      transaction_type: 'WITHDRAWAL',
      amount: totalDeducted,
      running_balance: params.sourceCurrentBalance - totalDeducted,
      reference_number: params.transfer.reference_number,
      description: `انتقال به بانک مقصد (مبلغ: ${X} + کارمزد: ${F})`,
      source_entity_type: 'BANK_TRANSFER',
      source_entity_id: params.transfer.id,
      journal_entry_id: journalEntryId,
      is_reconciled: true,
      reconciled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // BankStatementLine 2: Destination Bank Deposit (X)
    const destinationStatementLine: BankStatementLine = {
      id: crypto.randomUUID(),
      company_id: params.companyId,
      bank_account_id: params.destinationBankAccountId,
      entry_date: params.transfer.transfer_date,
      sequence_no: params.destinationNextSequenceNo,
      transaction_type: 'DEPOSIT',
      amount: X,
      running_balance: params.destinationCurrentBalance + X,
      reference_number: params.transfer.reference_number,
      description: `دریافت انتقال از بانک مبدأ`,
      source_entity_type: 'BANK_TRANSFER',
      source_entity_id: params.transfer.id,
      journal_entry_id: journalEntryId,
      is_reconciled: true,
      reconciled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    return {
      journalEntry,
      sourceStatementLine,
      destinationStatementLine,
    };
  }

  /**
   * Enforces double-entry balance check when posting any JournalEntry.
   */
  public enforceJournalBalance(entry: JournalEntry): void {
    const totalDebit = entry.lines.reduce((acc, l) => acc + l.debit, 0);
    const totalCredit = entry.lines.reduce((acc, l) => acc + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`سند حسابداری شماره ${entry.entry_number} تراز نیست! بدهکار: ${totalDebit} بستانکار: ${totalCredit}`);
    }
  }

  /**
   * Rejects an OperationalSettlementClaim and reverts the temporary operational debt balance.
   */
  public rejectClaim(
    claim: OperationalSettlementClaim,
    currentOperationalBalance: number,
    rejectionReason: string,
    reviewedByUserId: string
  ): { updatedClaim: OperationalSettlementClaim; restoredBalance: number } {
    if (claim.status !== 'UNMATCHED') {
      throw new Error(`Cannot reject claim with status ${claim.status}`);
    }

    const updatedClaim: OperationalSettlementClaim = {
      ...claim,
      status: 'REJECTED',
      rejection_reason: rejectionReason,
      reviewed_by_user_id: reviewedByUserId,
      reviewed_at: new Date().toISOString(),
    };

    // In customer claim, previously the debt was temporarily reduced by claimed_amount.
    // Rejection restores the debt: operational balance increases by claimed_amount.
    let restoredBalance = currentOperationalBalance;
    if (claim.claim_direction === 'CUSTOMER_RECEIPT') {
      restoredBalance += claim.claimed_amount;
    } else {
      restoredBalance -= claim.claimed_amount;
    }

    return {
      updatedClaim,
      restoredBalance,
    };
  }
}

export const treasuryFoundationService = new TreasuryFoundationService();
