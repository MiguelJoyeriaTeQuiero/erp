import { Module } from '@nestjs/common';
import { ValidationsService } from './validations.service';
import { ValidationsController, ClosureValidationsController } from './validations.controller';

@Module({
  controllers: [ValidationsController, ClosureValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}
