import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { FoundationModule } from '../foundation/foundation.module';

@Module({
  imports: [FoundationModule],
  controllers: [HealthController],
})
export class HealthModule {}
