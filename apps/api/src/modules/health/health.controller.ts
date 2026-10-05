import { Controller, Get, Inject } from '@nestjs/common';
import { FoundationService } from '../foundation/foundation.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(@Inject(FoundationService) private readonly foundationService: FoundationService) {}

  @Get()
  public getHealth() {
    return {
      success: true,
      data: this.foundationService.getHealth(),
    };
  }
}
