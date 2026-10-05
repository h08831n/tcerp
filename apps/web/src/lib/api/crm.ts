/**
 * TCERP - Frontend CRM API Client
 * Package: @tcerp/web
 */

import { httpClient } from './client';
import {
  PartyDetail,
  PartyRoleType,
  PartyRole,
  PartyPhone,
  Contact,
  Address,
  TimelineEvent,
  ConsolidatedResponsibilityReport,
  Party,
} from '@tcerp/domain';

export interface GetPartiesParams {
  query?: string;
  role?: PartyRoleType;
  salespersonId?: string;
  status?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
}

export interface GetPartiesResponse {
  items: PartyDetail[];
  total: number;
}

export const crmApi = {
  getParties(params?: GetPartiesParams): Promise<GetPartiesResponse> {
    return httpClient.get<GetPartiesResponse>('/api/v1/parties', params);
  },

  getParty(id: string): Promise<PartyDetail> {
    return httpClient.get<PartyDetail>(`/api/v1/parties/${id}`);
  },

  createParty(data: any): Promise<PartyDetail> {
    return httpClient.post<PartyDetail>('/api/v1/parties', data);
  },

  updateParty(id: string, updates: Partial<Party>): Promise<Party> {
    return httpClient.patch<Party>(`/api/v1/parties/${id}`, updates);
  },

  addRole(partyId: string, role: PartyRoleType): Promise<PartyRole> {
    return httpClient.post<PartyRole>(`/api/v1/parties/${partyId}/roles`, { role });
  },

  addPhone(partyId: string, phone: { phone_type: string; raw_number: string; is_primary?: boolean }): Promise<PartyPhone> {
    return httpClient.post<PartyPhone>(`/api/v1/parties/${partyId}/phones`, phone);
  },

  addContact(partyId: string, contact: { full_name: string; position?: string; email?: string; is_primary?: boolean }): Promise<Contact> {
    return httpClient.post<Contact>(`/api/v1/parties/${partyId}/contacts`, contact);
  },

  addAddress(partyId: string, address: { address_type: string; province: string; city: string; address_line: string; postal_code?: string; is_default?: boolean }): Promise<Address> {
    return httpClient.post<Address>(`/api/v1/parties/${partyId}/addresses`, address);
  },

  getTimeline(partyId: string): Promise<TimelineEvent[]> {
    return httpClient.get<TimelineEvent[]>(`/api/v1/parties/${partyId}/timeline`);
  },

  getFinancialResponsibility(partyId: string): Promise<ConsolidatedResponsibilityReport> {
    return httpClient.get<ConsolidatedResponsibilityReport>(`/api/v1/parties/${partyId}/financial-responsibility`);
  },
};
