import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IncidentType } from '@prisma/client';

export class CreateIncidentDto {
  @ApiProperty({ description: 'ID del cierre al que pertenece la incidencia' })
  @IsUUID()
  closureId!: string;

  @ApiPropertyOptional({ description: 'ID de la recogida relacionada (opcional)' })
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @ApiPropertyOptional({ description: 'ID de la sesión de validación relacionada (opcional)' })
  @IsOptional()
  @IsUUID()
  validationSessionId?: string;

  @ApiProperty({
    enum: IncidentType,
    description: 'Tipo de incidencia',
    example: IncidentType.DIFFERENCE,
  })
  @IsEnum(IncidentType)
  type!: IncidentType;

  @ApiProperty({
    description: 'Descripción detallada del motivo de la incidencia',
    minLength: 10,
    example: 'El peso real del material difiere en más de 1g respecto al declarado por el cliente',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason!: string;
}
