/**
 * TCERP - Frontend Auth API Client
 * Package: @tcerp/web
 */

import { httpClient } from './client';
import { User, Role, RolePermission } from '@tcerp/domain';

export interface AuthContextResponse {
  user: User;
  roles: Role[];
  permissions: RolePermission[];
  teamMemberIds: string[];
}

export const authApi = {
  getMe(): Promise<AuthContextResponse> {
    return httpClient.get<AuthContextResponse>('/api/v1/auth/me');
  },

  switchUser(userId: string, companyId: string = 'comp-001-arvin'): Promise<AuthContextResponse> {
    httpClient.setSession(userId, companyId);
    return httpClient.get<AuthContextResponse>('/api/v1/auth/me');
  },
};
