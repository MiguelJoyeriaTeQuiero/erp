import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IncidentStatus, IncidentType } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FilterIncidentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por cierre' })
  @IsOptional()
  @IsUUID()
  closureId?: string;

  @ApiPropertyOptional({ enum: IncidentType, description: 'Filtrar por tipo de incidencia' })
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;

  @ApiPropertyOptional({ enum: IncidentStatus, description: 'Filtrar por estado' })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ description: 'Fecha de creación desde (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha de creación hasta (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
