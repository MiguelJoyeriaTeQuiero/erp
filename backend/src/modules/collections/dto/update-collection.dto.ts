import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCollectionDto {
  @ApiPropertyOptional({
    description:
      'Marcar como NO parcial (false) para finalizar la recogida y disparar el gap-check. ' +
      'No se permite revertir de false a true.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPartial?: boolean;

  @ApiPropertyOptional({
    description: 'Observaciones adicionales',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observations?: string;

  @ApiPropertyOptional({
    description: 'Fecha y hora de la recogida (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  collectedAt?: string;
}
