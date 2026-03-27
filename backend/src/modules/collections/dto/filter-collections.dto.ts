import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CollectionStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FilterCollectionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por cierre' })
  @IsOptional()
  @IsUUID()
  closureId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por comercial que recogió' })
  @IsOptional()
  @IsUUID()
  collectorId?: string;

  @ApiPropertyOptional({ enum: CollectionStatus, description: 'Filtrar por estado de la recogida' })
  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;

  @ApiPropertyOptional({ description: 'Fecha de recogida desde (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha de recogida hasta (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
