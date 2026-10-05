/**
 * TCERP - Frontend Foundation & System API Client
 * Package: @tcerp/web
 */

import { httpClient } from './client';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export const foundationApi = {
  async getHealth(): Promise<any> {
    const res = await httpClient.get<ApiResponse<any>>('/api/v1/foundation/health');
    return res.data;
  },

  async getUsers(): Promise<any[]> {
    const res = await httpClient.get<ApiResponse<any[]>>('/api/v1/foundation/users');
    return res.data;
  },

  async getRoles(): Promise<any[]> {
    const res = await httpClient.get<ApiResponse<any[]>>('/api/v1/foundation/roles');
    return res.data;
  },

  async getPermissions(): Promise<any[]> {
    const res = await httpClient.get<ApiResponse<any[]>>('/api/v1/foundation/permissions');
    return res.data;
  },

  async getSequences(companyId: string): Promise<any[]> {
    const res = await httpClient.get<ApiResponse<any[]>>('/api/v1/foundation/sequences', { companyId });
    return res.data;
  },

  async generateNextSequence(companyId: string, docType: string): Promise<string> {
    const res = await httpClient.post<ApiResponse<{ number: string }>>('/api/v1/foundation/sequences/generate', { companyId, docType });
    return res.data.number;
  },

  async getAuditLogs(companyId: string): Promise<any[]> {
    const res = await httpClient.get<ApiResponse<any[]>>('/api/v1/foundation/audit-logs', { companyId });
    return res.data;
  },

  async getQueueState(): Promise<any> {
    const res = await httpClient.get<ApiResponse<any>>('/api/v1/foundation/queue-state');
    return res.data;
  },

  async getDiagnostics(): Promise<any> {
    const res = await httpClient.get<ApiResponse<any>>('/api/v1/foundation/diagnostics');
    return res.data;
  },
};
