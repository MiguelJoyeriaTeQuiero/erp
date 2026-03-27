import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClosureStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FilterClosureDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ClosureStatus, description: 'Filtrar por estado' })
  @IsOptional()
  @IsEnum(ClosureStatus)
  status?: ClosureStatus;

  @ApiPropertyOptional({ description: 'Filtrar por ID de cliente' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID del creador' })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Campo de ordenación', enum: ['createdAt', 'code', 'totalAmount', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'code', 'totalAmount', 'status'])
  sortBy?: 'createdAt' | 'code' | 'totalAmount' | 'status';

  @ApiPropertyOptional({ description: 'Dirección de ordenación', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
