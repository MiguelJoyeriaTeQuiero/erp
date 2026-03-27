import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCollectionDto {
  @ApiProperty({
    description: 'Fecha y hora de la recogida (ISO 8601)',
    example: '2026-03-26T10:00:00.000Z',
  })
  @IsDateString()
  collectedAt!: string;

  @ApiProperty({
    description: 'Indica si la recogida es parcial (habrá más material en futuras recogidas)',
    example: false,
  })
  @IsBoolean()
  isPartial!: boolean;

  @ApiPropertyOptional({
    description: 'Observaciones sobre la recogida',
    example: 'El cliente entregó el material en bolsa sin clasificar',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observations?: string;
}
