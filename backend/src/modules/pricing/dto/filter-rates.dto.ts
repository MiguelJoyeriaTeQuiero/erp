import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FilterRatesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por tipo de metal' })
  @IsOptional()
  @IsUUID()
  metalTypeId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por quilataje' })
  @IsOptional()
  @IsUUID()
  karatId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría de cliente' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Solo tarifas activas (default: todas)' })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}

export class CurrentRateQueryDto {
  @ApiPropertyOptional({ description: 'ID del tipo de metal' })
  @IsOptional()
  @IsUUID()
  metalTypeId?: string;

  @ApiPropertyOptional({ description: 'ID del quilataje' })
  @IsOptional()
  @IsUUID()
  karatId?: string;

  @ApiPropertyOptional({ description: 'ID de la categoría de cliente' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
