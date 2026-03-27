import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResolveIncidentDto {
  @ApiProperty({
    description: 'Descripción de cómo se resolvió la incidencia (obligatorio para trazabilidad)',
    minLength: 10,
    example: 'El cliente reentregó los 2g faltantes de oro 18k en visita posterior. Material verificado.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  resolution!: string;
}
