/**
 * TCERP - NestJS CRM Controller
 * Provides real RESTful HTTP routes for Party & CRM Domain.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  UsePipes,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { CrmService } from './crm.service';
import { NestPermissionGuard } from '../../common/guards/nest-permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SecurityContext } from '../iam/permission.guard';
import {
  CreatePartyDto,
  PhoneInputDto,
  AddressInputDto,
  ContactInputDto,
} from './dto/create-party.dto';
import {
  UpdatePartyDto,
  AddRoleDto,
  AddPhoneDto,
  AddContactDto,
  AddAddressDto,
} from './dto/update-party.dto';
import { GetPartiesQueryDto } from './dto/get-parties-query.dto';

@Controller('api/v1/parties')
@UseGuards(NestPermissionGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrmController {
  constructor(@Inject(CrmService) private readonly crmService: CrmService) {}

  /**
   * GET /api/v1/parties
   */
  @Get()
  @RequirePermission('crm', 'view')
  public async getParties(
    @Query() query: GetPartiesQueryDto,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const companyId = userCtx.user.company_id;
    return this.crmService.getParties(
      companyId,
      {
        query: query.query,
        role: query.role,
        salespersonId: query.salespersonId,
        status: query.status,
        includeArchived: query.includeArchived,
        page: query.page,
        limit: query.limit,
      },
      userCtx
    );
  }

  /**
   * GET /api/v1/parties/:id
   */
  @Get(':id')
  @RequirePermission('crm', 'view')
  public async getPartyById(
    @Param('id') id: string,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    return party;
  }

  /**
   * POST /api/v1/parties
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('crm', 'create')
  public async createParty(
    @Body() dto: any,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const companyId = userCtx.user.company_id;
    const partyData = dto.party || dto;
    const name_fa = partyData.name_fa || dto.name_fa;
    const party_type = partyData.party_type || dto.party_type || 'COMPANY';
    const roles = dto.roles || partyData.roles || ['CUSTOMER'];
    const phones = dto.phones || partyData.phones || [];
    const addresses = dto.addresses || partyData.addresses || [];
    const contacts = dto.contacts || partyData.contacts || [];

    if (!name_fa || typeof name_fa !== 'string' || name_fa.trim().length < 2) {
      throw new BadRequestException('نام طرف‌حساب باید حداقل ۲ کاراکتر باشد.');
    }

    const res = await this.crmService.createParty(
      companyId,
      {
        party: {
          company_id: companyId,
          party_type: party_type,
          name_fa: name_fa.trim(),
          name_en: partyData.name_en,
          national_id: partyData.national_id,
          economic_code: partyData.economic_code,
          registration_number: partyData.registration_number,
          postal_code: partyData.postal_code,
          website: partyData.website,
          email: partyData.email,
          assigned_salesperson_id: partyData.assigned_salesperson_id,
          customer_score_level: partyData.customer_score_level || 'BRONZE',
          risk_flag: Boolean(partyData.risk_flag),
          operational_balance: partyData.operational_balance || 0,
          status: partyData.status || 'ACTIVE',
        },
        roles,
        phones: phones.map((ph: any) => ({
          company_id: companyId,
          phone_type: ph.phone_type || 'MOBILE',
          raw_number: ph.raw_number,
          is_primary: Boolean(ph.is_primary),
        })),
        addresses: addresses.map((addr: any) => ({
          address_type: addr.address_type || 'MAIN',
          province: addr.province || '',
          city: addr.city || '',
          address_line: addr.address_line || '',
          postal_code: addr.postal_code,
          is_default: Boolean(addr.is_default),
        })),
        contacts: contacts.map((c: any) => ({
          contact: {
            full_name: c.contact ? c.contact.full_name : c.full_name,
            position: c.contact ? c.contact.position : c.position,
            email: c.contact ? c.contact.email : c.email,
            is_primary: Boolean(c.contact ? c.contact.is_primary : c.is_primary),
          },
          phones: (c.phones || (c.contact && c.contact.phones) || []).map((cp: any) => ({
            phone_type: cp.phone_type || 'MOBILE',
            raw_number: cp.raw_number,
            is_primary: Boolean(cp.is_primary),
          })),
        })),
      },
      userCtx
    );
    return res.party || res;
  }

  /**
   * PATCH /api/v1/parties/:id
   */
  @Patch(':id')
  @RequirePermission('crm', 'update')
  public async updateParty(
    @Param('id') id: string,
    @Body() dto: UpdatePartyDto,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    return this.crmService.updateParty(id, dto as any, userCtx);
  }

  /**
   * POST /api/v1/parties/:id/roles
   */
  @Post(':id/roles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('crm', 'update')
  public async addRole(
    @Param('id') id: string,
    @Body() dto: AddRoleDto,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    return this.crmService.addRole(id, dto.role as any, userCtx);
  }

  /**
   * POST /api/v1/parties/:id/phones
   */
  @Post(':id/phones')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('crm', 'update')
  public async addPhone(
    @Param('id') id: string,
    @Body() dto: AddPhoneDto,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    return this.crmService.addPhone(
      id,
      {
        phone_type: dto.phone_type as any,
        raw_number: dto.raw_number,
        is_primary: dto.is_primary,
      },
      userCtx
    );
  }

  /**
   * POST /api/v1/parties/:id/contacts
   */
  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('crm', 'update')
  public async addContact(
    @Param('id') id: string,
    @Body() dto: AddContactDto,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    const phones = dto.phones || (dto.raw_number ? [{ phone_type: 'MOBILE', raw_number: dto.raw_number }] : []);
    return this.crmService.addContact(
      id,
      {
        full_name: dto.full_name,
        position: dto.position,
        email: dto.email,
        is_primary: dto.is_primary,
      },
      phones,
      userCtx
    );
  }

  /**
   * POST /api/v1/parties/:id/addresses
   */
  @Post(':id/addresses')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('crm', 'update')
  public async addAddress(
    @Param('id') id: string,
    @Body() dto: AddAddressDto,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    return this.crmService.addAddress(
      id,
      {
        address_type: dto.address_type as any,
        province: dto.province,
        city: dto.city,
        address_line: dto.address_line,
        postal_code: dto.postal_code,
        is_default: dto.is_default,
      },
      userCtx
    );
  }

  /**
   * GET /api/v1/parties/:id/timeline
   */
  @Get(':id/timeline')
  @RequirePermission('crm', 'view')
  public async getTimeline(
    @Param('id') id: string,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    return this.crmService.getTimeline(id);
  }

  /**
   * GET /api/v1/parties/:id/financial-responsibility
   */
  @Get(':id/financial-responsibility')
  @RequirePermission('crm', 'view')
  public async getFinancialResponsibility(
    @Param('id') id: string,
    @CurrentUser() userCtx: SecurityContext
  ) {
    const party = await this.crmService.getPartyById(id, userCtx);
    if (!party) {
      throw new NotFoundException(`طرف‌حساب با شناسه ${id} یافت نشد.`);
    }
    return this.crmService.getFinancialResponsibilityReport(id);
  }
}
