/**
 * TCERP - Concurrency-Safe Sequence & Document Numbering Service
 * Enforces atomic increments, race-condition safety, customizable formatting, and reset cycles.
 */

import { Sequence } from '@tcerp/domain';

export class SequenceService {
  private sequences: Map<string, Sequence> = new Map();
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * Registers or updates a sequence configuration.
   */
  public registerSequence(seq: Sequence): void {
    const key = `${seq.company_id}:${seq.document_type}`;
    this.sequences.set(key, { ...seq });
  }

  /**
   * Concurrency-safe atomic generation of the next document number.
   * Simulates PostgreSQL row-level lock (SELECT ... FOR UPDATE).
   */
  public async generateNextNumber(companyId: string, documentType: string, date: Date = new Date()): Promise<string> {
    const key = `${companyId}:${documentType}`;
    
    // Acquire mutex lock per sequence key
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      let seq = this.sequences.get(key);
      if (!seq) {
        // Create default sequence if not present
        seq = {
          id: crypto.randomUUID(),
          company_id: companyId,
          document_type: documentType,
          prefix: documentType.substring(0, 3).toUpperCase(),
          year_format: 'JALALI_4',
          padding_digits: 5,
          current_number: 0,
          reset_cycle: 'YEARLY_FISCAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.sequences.set(key, seq);
      }

      // Check reset cycles
      this.checkAndApplyReset(seq, date);

      // Increment atomically
      seq.current_number += 1;
      seq.updated_at = new Date().toISOString();

      // Format document number
      const formatted = this.formatDocumentNumber(seq, date);
      return formatted;
    } finally {
      this.locks.delete(key);
      releaseLock();
    }
  }

  /**
   * Retrieves the current sequence details.
   */
  public getSequence(companyId: string, documentType: string): Sequence | undefined {
    return this.sequences.get(`${companyId}:${documentType}`);
  }

  private checkAndApplyReset(seq: Sequence, date: Date): void {
    if (seq.reset_cycle === 'NEVER') return;

    const currentYear = this.getYear(date, seq.year_format);
    const lastResetDate = seq.last_reset_date ? new Date(seq.last_reset_date) : null;
    const lastResetYear = lastResetDate ? this.getYear(lastResetDate, seq.year_format) : null;

    if (lastResetYear !== null && currentYear !== lastResetYear) {
      seq.current_number = 0;
      seq.last_reset_date = date.toISOString().split('T')[0];
    }
  }

  private formatDocumentNumber(seq: Sequence, date: Date): string {
    const yearPart = seq.year_format === 'NONE' ? '' : `-${this.getYear(date, seq.year_format)}`;
    const paddedNum = String(seq.current_number).padStart(seq.padding_digits, '0');
    return `${seq.prefix}${yearPart}-${paddedNum}`;
  }

  private getYear(date: Date, format: Sequence['year_format']): string {
    if (format === 'GREGORIAN_4') {
      return String(date.getFullYear());
    }
    // Standard Jalali 1404/1405 year conversion
    const gYear = date.getFullYear();
    const gMonth = date.getMonth() + 1;
    // Approximating Jalali year safely: March 21 is Iranian New Year
    const jYear = gMonth < 3 || (gMonth === 3 && date.getDate() < 21) ? gYear - 622 : gYear - 621;
    return String(jYear);
  }
}

export const sequenceService = new SequenceService();
