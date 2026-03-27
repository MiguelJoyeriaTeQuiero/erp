import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { PricingCron } from './pricing.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PricingController],
  providers: [PricingService, PricingCron],
  exports: [PricingService],
})
export class PricingModule {}
