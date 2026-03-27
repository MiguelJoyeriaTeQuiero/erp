import { Module } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CollectionsController, ClosureCollectionsController } from './collections.controller';
import { ConversionsController } from './conversions.controller';

@Module({
  controllers: [CollectionsController, ClosureCollectionsController, ConversionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
