/**
 * FooladERP - IAM Permission Guard
 * Enforces backend RBAC, Granular Module Actions, Record Scope, and Sensitive Field Policies.
 */

import { RecordScope, Role, RolePermission, User } from '@foolad/domain';

export interface SecurityContext {
  user: User;
  roles: Role[];
  permissions: RolePermission[];
  teamMemberIds: string[];
}

export class PermissionGuard {
  /**
   * Verifies if a user has permission to perform an action on a module.
   */
  public static can(
    ctx: SecurityContext,
    module: string,
    action: string
  ): { allowed: boolean; maxScope: RecordScope; fieldPolicy: Record<string, 'HIDDEN' | 'READ_ONLY' | 'EDITABLE'> } {
    const matchingPerms = ctx.permissions.filter(
      p => (p as unknown as { module: string; action: string }).module === module &&
           (p as unknown as { module: string; action: string }).action === action
    );

    if (matchingPerms.length === 0) {
      return { allowed: false, maxScope: 'OWN', fieldPolicy: {} };
    }

    // Determine highest scope (ALL > TEAM > ASSIGNED > OWN)
    const scopePriority: Record<RecordScope, number> = {
      ALL: 4,
      TEAM: 3,
      ASSIGNED: 2,
      OWN: 1,
    };

    let highestScope: RecordScope = 'OWN';
    let highestPriority = 0;
    const mergedFieldPolicy: Record<string, 'HIDDEN' | 'READ_ONLY' | 'EDITABLE'> = {};

    for (const p of matchingPerms) {
      if (scopePriority[p.record_scope] > highestPriority) {
        highestPriority = scopePriority[p.record_scope];
        highestScope = p.record_scope;
      }
      if (p.field_policy) {
        Object.assign(mergedFieldPolicy, p.field_policy);
      }
    }

    return {
      allowed: true,
      maxScope: highestScope,
      fieldPolicy: mergedFieldPolicy,
    };
  }

  /**
   * Checks if user has access to a specific record based on scope.
   */
  public static canAccessRecord(
    ctx: SecurityContext,
    scope: RecordScope,
    record: { created_by?: string; assigned_to?: string; team_id?: string }
  ): boolean {
    if (scope === 'ALL') return true;

    if (scope === 'TEAM') {
      if (record.team_id && ctx.teamMemberIds.includes(record.team_id)) return true;
      if (record.created_by && ctx.teamMemberIds.includes(record.created_by)) return true;
    }

    if (scope === 'ASSIGNED') {
      if (record.assigned_to === ctx.user.id) return true;
    }

    if (scope === 'OWN') {
      if (record.created_by === ctx.user.id) return true;
    }

    return false;
  }

  /**
   * Sanitizes record by masking or removing sensitive fields (e.g. profit, purchase prices).
   */
  public static sanitizeSensitiveFields<T extends Record<string, unknown>>(
    record: T,
    fieldPolicy: Record<string, 'HIDDEN' | 'READ_ONLY' | 'EDITABLE'>
  ): T {
    const clone = { ...record };
    for (const [field, policy] of Object.entries(fieldPolicy)) {
      if (policy === 'HIDDEN' && field in clone) {
        delete clone[field];
      }
    }
    return clone;
  }
}
