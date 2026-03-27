import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IncidentStatus } from '@prisma/client';

/**
 * Solo se puede actualizar la razón y mover el estado a IN_REVIEW via PATCH.
 * Para resolver o cancelar, usar los endpoints específicos.
 */
export class UpdateIncidentDto {
  @ApiPropertyOptional({
    enum: IncidentStatus,
    description: 'Solo se permite mover a IN_REVIEW. Usa /resolve o /cancel para otros estados.',
  })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({
    description: 'Actualización del motivo de la incidencia',
    minLength: 10,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason?: string;
}
