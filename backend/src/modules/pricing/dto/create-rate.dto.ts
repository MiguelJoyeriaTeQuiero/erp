import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateRateDto {
  @ApiProperty({ description: 'ID del tipo de metal' })
  @IsUUID()
  metalTypeId!: string;

  @ApiProperty({ description: 'ID del quilataje' })
  @IsUUID()
  karatId!: string;

  @ApiProperty({ description: 'ID de la categoría de cliente' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: '41.25', description: 'Precio por gramo en euros (Decimal como string)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'El precio debe ser un número positivo con hasta 2 decimales' })
  pricePerGram!: string;

  @ApiPropertyOptional({ description: 'Inicio de vigencia (ISO 8601). Si se omite, se usa la fecha actual.' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Fin de vigencia (ISO 8601). Null = indefinido.' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
