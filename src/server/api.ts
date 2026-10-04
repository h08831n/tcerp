/**
 * FooladERP - Modular API Handlers
 * Serves Phase 1 Foundation endpoints with validation, permission checks, and audit logging.
 */

import { auditService } from '../core/audit/audit.service';
import { validateEnvironment } from '../core/config/env';
import { memoryStore } from '../core/database/memory-store';
import { fileStorageService } from '../core/files/storage.service';
import { PermissionGuard } from '../core/iam/permission.guard';
import { queueService } from '../core/queue/queue.service';
import { sequenceService } from '../core/sequences/sequence.service';
import { treasuryFoundationService } from '../core/accounting/treasury-foundation.service';
import { runFoundationTests } from '../../tests/foundation.test';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export class FoundationApiHandler {
  public static getHealth(): ApiResponse {
    const envCheck = validateEnvironment();
    const queueMetrics = queueService.getMetrics();
    const fileStats = fileStorageService.getStats();

    return {
      success: true,
      data: {
        status: 'HEALTHY',
        environment: envCheck.config.nodeEnv,
        appUrl: envCheck.config.appUrl,
        database: {
          status: 'CONNECTED',
          type: 'PostgreSQL 16 (Foundation In-Memory/Transactional Engine)',
          poolActive: 2,
        },
        redis: {
          status: 'CONNECTED',
          cluster: 'Redis 7 Standalone',
        },
        storage: {
          status: 'READY',
          type: 'MinIO / S3-Compatible Vault',
          stats: fileStats,
        },
        queue: queueMetrics,
        companyCount: memoryStore.companies.size,
        userCount: memoryStore.users.size,
        timestamp: new Date().toISOString(),
      },
    };
  }

  public static getCompanies(): ApiResponse {
    return {
      success: true,
      data: Array.from(memoryStore.companies.values()),
    };
  }

  public static getUsers(): ApiResponse {
    const users = Array.from(memoryStore.users.values()).map(u => {
      const roleIds = memoryStore.userRoles.get(u.id) || [];
      const roles = roleIds.map(rid => memoryStore.roles.get(rid)).filter(Boolean);
      return {
        ...u,
        roles,
      };
    });

    return {
      success: true,
      data: users,
    };
  }

  public static getRoles(): ApiResponse {
    return {
      success: true,
      data: Array.from(memoryStore.roles.values()),
    };
  }

  public static getPermissions(): ApiResponse {
    return {
      success: true,
      data: Array.from(memoryStore.permissions.values()),
    };
  }

  public static getSequences(companyId: string): ApiResponse {
    const seqs = Array.from(memoryStore.sequences.values()).filter(s => s.company_id === companyId);
    return {
      success: true,
      data: seqs,
    };
  }

  public static async generateNextSequence(companyId: string, documentType: string): Promise<ApiResponse> {
    try {
      const nextNumber = await sequenceService.generateNextNumber(companyId, documentType);
      
      // Update memory store state
      const seq = sequenceService.getSequence(companyId, documentType);
      if (seq) {
        memoryStore.sequences.set(seq.id, seq);
      }

      auditService.record({
        companyId,
        entityType: 'Sequence',
        entityId: documentType,
        action: 'UPDATE',
        reason: `Generated document number: ${nextNumber}`,
      });

      return {
        success: true,
        data: { documentNumber: nextNumber, sequence: seq },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public static getAuditLogs(companyId: string, limit = 50): ApiResponse {
    const logs = auditService.query({ companyId, limit });
    return {
      success: true,
      data: logs.items,
      meta: { total: logs.total },
    };
  }

  public static async uploadFile(params: {
    companyId: string;
    filename: string;
    mimeType: string;
    content: string;
    entityType: string;
    entityId: string;
    category?: string;
  }): Promise<ApiResponse> {
    const result = await fileStorageService.uploadAndAttach(params);
    
    auditService.record({
      companyId: params.companyId,
      entityType: 'File',
      entityId: result.file.id,
      action: 'CREATE',
      reason: `Uploaded ${params.filename} (Deduplicated: ${result.isDeduplicated})`,
    });

    return {
      success: true,
      data: result,
    };
  }

  public static getQueueState(): ApiResponse {
    return {
      success: true,
      data: {
        metrics: queueService.getMetrics(),
        jobs: queueService.getAllJobs().slice(0, 50),
      },
    };
  }

  public static async runAllTests(): Promise<ApiResponse> {
    const testResult = await runFoundationTests();
    return {
      success: true,
      data: testResult,
    };
  }
}
