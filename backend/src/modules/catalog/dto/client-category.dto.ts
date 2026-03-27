import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateClientCategoryDto {
  @ApiProperty({ example: 'VIP', description: 'Nombre de la categoría' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  @ApiProperty({ example: 'vip', description: 'Slug único en minúsculas' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener minúsculas, números y guiones' })
  slug!: string;

  @ApiProperty({ example: '1.0500', description: 'Multiplicador de precio (Decimal)' })
  @IsString()
  @IsNotEmpty({ message: 'El multiplicador de precio es obligatorio' })
  priceMultiplier!: string;

  @ApiPropertyOptional({ example: 'Clientes VIP con precio especial' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}

export class UpdateClientCategoryDto extends PartialType(CreateClientCategoryDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
