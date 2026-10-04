/**
 * FooladERP - AuditLog Service
 * Guarantees immutable logging of all critical business & financial operations.
 */

import { AuditAction, AuditLog } from '../types/foundation';

export class AuditService {
  private logs: AuditLog[] = [];

  /**
   * Records an immutable audit log entry.
   */
  public record(params: {
    companyId: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    reason?: string;
  }): AuditLog {
    const diff = this.calculateDiff(params.oldValues, params.newValues);

    const logEntry: AuditLog = {
      id: crypto.randomUUID(),
      company_id: params.companyId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      user_id: params.userId,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      old_values: params.oldValues ? JSON.parse(JSON.stringify(params.oldValues)) : undefined,
      new_values: params.newValues ? JSON.parse(JSON.stringify(params.newValues)) : undefined,
      diff,
      reason: params.reason,
      created_at: new Date().toISOString(),
    };

    // Store in-memory / DB table
    this.logs.unshift(logEntry);
    return logEntry;
  }

  /**
   * Retrieves audit logs for a specific entity or company with pagination.
   */
  public query(filter: {
    companyId: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  }): { items: AuditLog[]; total: number } {
    let filtered = this.logs.filter(l => l.company_id === filter.companyId);

    if (filter.entityType) {
      filtered = filtered.filter(l => l.entity_type === filter.entityType);
    }
    if (filter.entityId) {
      filtered = filtered.filter(l => l.entity_id === filter.entityId);
    }
    if (filter.userId) {
      filtered = filtered.filter(l => l.user_id === filter.userId);
    }
    if (filter.action) {
      filtered = filtered.filter(l => l.action === filter.action);
    }

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  private calculateDiff(
    oldObj?: Record<string, unknown>,
    newObj?: Record<string, unknown>
  ): Record<string, { old: unknown; new: unknown }> | undefined {
    if (!oldObj && !newObj) return undefined;
    if (!oldObj) {
      const diff: Record<string, { old: unknown; new: unknown }> = {};
      for (const key of Object.keys(newObj || {})) {
        diff[key] = { old: null, new: (newObj as Record<string, unknown>)[key] };
      }
      return diff;
    }
    if (!newObj) {
      const diff: Record<string, { old: unknown; new: unknown }> = {};
      for (const key of Object.keys(oldObj || {})) {
        diff[key] = { old: oldObj[key], new: null };
      }
      return diff;
    }

    const diff: Record<string, { old: unknown; new: unknown }> = {};
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const oldVal = oldObj[key];
      const newVal = newObj[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal };
      }
    }

    return Object.keys(diff).length > 0 ? diff : undefined;
  }
}

export const auditService = new AuditService();
