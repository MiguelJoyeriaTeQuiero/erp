import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Solo se puede actualizar el borrador — campo clientId es inmutable tras la creación */
export class UpdateClosureDto {
  @ApiPropertyOptional({ description: 'Observaciones del cierre (solo en estado BORRADOR)' })
  @IsOptional()
  @IsString()
  observations?: string;
}
