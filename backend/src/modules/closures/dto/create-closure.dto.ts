import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClosureDto {
  @ApiProperty({ description: 'ID del cliente' })
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({ description: 'Observaciones generales del cierre' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observations?: string;
}
