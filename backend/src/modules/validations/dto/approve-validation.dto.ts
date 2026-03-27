import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveValidationDto {
  @ApiPropertyOptional({ description: 'Observaciones finales del validador al aprobar' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observations?: string;
}
