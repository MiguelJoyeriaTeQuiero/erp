import { Module } from '@nestjs/common';
import { ClosuresService } from './closures.service';
import { ClosuresController } from './closures.controller';

@Module({
  controllers: [ClosuresController],
  providers: [ClosuresService],
  exports: [ClosuresService],
})
export class ClosuresModule {}
