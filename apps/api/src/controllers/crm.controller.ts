/**
 * TCERP - CRM API Controller
 * Package: @tcerp/api
 */

import { crmService } from '../modules/crm/crm.service';
import { SecurityContext } from '../modules/iam/permission.guard';
import { ApiResponse } from './foundation.controller';
import { PartyRoleType } from '@tcerp/domain';

export class CrmController {
  public static async getParties(params: {
    companyId: string;
    query?: string;
    role?: PartyRoleType;
    salespersonId?: string;
    status?: string;
    includeArchived?: boolean;
    page?: number;
    limit?: number;
    userCtx: SecurityContext;
  }): Promise<ApiResponse> {
    try {
      const result = await crmService.getParties(
        params.companyId,
        {
          query: params.query,
          role: params.role,
          salespersonId: params.salespersonId,
          status: params.status,
          includeArchived: params.includeArchived,
          page: params.page,
          limit: params.limit,
        },
        params.userCtx
      );
      return { success: true, data: result.items, meta: { total: result.total } };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async getPartyById(partyId: string, userCtx: SecurityContext): Promise<ApiResponse> {
    try {
      const party = await crmService.getPartyById(partyId, userCtx);
      return { success: true, data: party };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async checkDuplicates(
    companyId: string,
    params: { nameFa: string; mobileNumber?: string; excludePartyId?: string },
    userCtx: SecurityContext
  ): Promise<ApiResponse> {
    try {
      const result = await crmService.checkDuplicates(companyId, params, userCtx);
      return { success: true, data: result };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async createParty(
    companyId: string,
    data: any,
    userCtx: SecurityContext
  ): Promise<ApiResponse> {
    try {
      const result = await crmService.createParty(companyId, data, userCtx);
      return { success: true, data: result.party };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async updateParty(
    partyId: string,
    updates: any,
    userCtx: SecurityContext
  ): Promise<ApiResponse> {
    try {
      const updated = await crmService.updateParty(partyId, updates, userCtx);
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async addRole(partyId: string, roleType: PartyRoleType, userCtx: SecurityContext): Promise<ApiResponse> {
    try {
      const role = await crmService.addRole(partyId, roleType, userCtx);
      return { success: true, data: role };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async addPhone(partyId: string, phoneData: any, userCtx: SecurityContext): Promise<ApiResponse> {
    try {
      const phone = await crmService.addPhone(partyId, phoneData, userCtx);
      return { success: true, data: phone };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async addContact(partyId: string, contactData: any, phones: any[], userCtx: SecurityContext): Promise<ApiResponse> {
    try {
      const contact = await crmService.addContact(partyId, contactData, phones || [], userCtx);
      return { success: true, data: contact };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async addAddress(partyId: string, addressData: any, userCtx: SecurityContext): Promise<ApiResponse> {
    try {
      const address = await crmService.addAddress(partyId, addressData, userCtx);
      return { success: true, data: address };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async getTimeline(partyId: string): Promise<ApiResponse> {
    try {
      const events = await crmService.getTimeline(partyId);
      return { success: true, data: events };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async getFinancialResponsibility(partyId: string): Promise<ApiResponse> {
    try {
      const report = await crmService.getFinancialResponsibilityReport(partyId);
      return { success: true, data: report };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public static async linkFinancialResponsibility(
    companyId: string,
    guarantorPartyId: string,
    guaranteedPartyId: string,
    notes: string | undefined,
    userCtx: SecurityContext
  ): Promise<ApiResponse> {
    try {
      const link = await crmService.linkFinancialResponsibility(companyId, guarantorPartyId, guaranteedPartyId, notes, userCtx);
      return { success: true, data: link };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
