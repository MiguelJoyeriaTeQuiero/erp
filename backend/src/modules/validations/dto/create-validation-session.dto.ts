import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateValidationSessionDto {
  @ApiPropertyOptional({
    description: 'ID de la recogida asociada (opcional, para validación por recogida)',
  })
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @ApiPropertyOptional({ description: 'Observaciones generales de la sesión' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observations?: string;
}
