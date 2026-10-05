import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { FoundationService } from './foundation.service';
import { NestPermissionGuard } from '../../common/guards/nest-permission.guard';

@Controller('api/v1/foundation')
@UseGuards(NestPermissionGuard)
export class FoundationController {
  constructor(@Inject(FoundationService) private readonly foundationService: FoundationService) {}

  @Get('health')
  public getHealth() {
    return {
      success: true,
      data: this.foundationService.getHealth(),
    };
  }

  @Get('companies')
  public getCompanies() {
    return {
      success: true,
      data: this.foundationService.getCompanies(),
    };
  }

  @Get('users')
  public getUsers() {
    return {
      success: true,
      data: this.foundationService.getUsers(),
    };
  }

  @Get('roles')
  public getRoles() {
    return {
      success: true,
      data: this.foundationService.getRoles(),
    };
  }

  @Get('permissions')
  public getPermissions() {
    return {
      success: true,
      data: this.foundationService.getPermissions(),
    };
  }

  @Get('sequences')
  public getSequences(@Query('companyId') companyId: string) {
    return {
      success: true,
      data: this.foundationService.getSequences(companyId || 'comp-001-arvin'),
    };
  }

  @Post('sequences/generate')
  public generateNextSequence(
    @Body('companyId') companyId: string,
    @Body('docType') docType: string
  ) {
    const number = this.foundationService.generateNextSequence(
      companyId || 'comp-001-arvin',
      docType || 'SALES_DOCUMENT'
    );
    return {
      success: true,
      data: { number },
    };
  }

  @Get('audit-logs')
  public getAuditLogs(@Query('companyId') companyId: string) {
    return {
      success: true,
      data: this.foundationService.getAuditLogs(companyId || 'comp-001-arvin'),
    };
  }

  @Get('queue-state')
  public getQueueState() {
    return {
      success: true,
      data: this.foundationService.getQueueState(),
    };
  }

  @Get('diagnostics')
  public getDiagnostics() {
    return {
      success: true,
      data: this.foundationService.getDiagnostics(),
    };
  }
}
