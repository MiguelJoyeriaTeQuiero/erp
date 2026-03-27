import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClientType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FilterClientDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre comercial, razón social o persona de contacto' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por NIF/CIF exacto' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ enum: ClientType, description: 'Filtrar por tipo de cliente' })
  @IsOptional()
  @IsEnum(ClientType)
  type?: ClientType;

  @ApiPropertyOptional({ description: 'Filtrar por ID de categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo (por defecto solo activos)' })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
