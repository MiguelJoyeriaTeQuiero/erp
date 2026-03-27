import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RejectConversionDto {
  @ApiProperty({
    description: 'Motivo del rechazo (obligatorio para trazabilidad)',
    example: 'El material entregado no corresponde a la conversión acordada',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason!: string;
}
