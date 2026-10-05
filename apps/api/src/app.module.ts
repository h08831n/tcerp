import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CrmModule } from './modules/crm/crm.module';
import { AuthModule } from './modules/auth/auth.module';
import { FoundationModule } from './modules/foundation/foundation.module';
import { HealthModule } from './modules/health/health.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { NestPermissionGuard } from './common/guards/nest-permission.guard';

@Module({
  imports: [
    CrmModule,
    AuthModule,
    FoundationModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: NestPermissionGuard,
    },
  ],
})
export class AppModule {}
