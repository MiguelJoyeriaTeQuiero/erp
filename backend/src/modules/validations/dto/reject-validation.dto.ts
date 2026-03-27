import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RejectValidationDto {
  @ApiProperty({
    description:
      'Motivo del rechazo. Obligatorio — se registrará en las incidencias generadas automáticamente.',
    minLength: 10,
    example: 'Gramos no cuadran con lo declarado en recogida; material presenta signos de no ser oro 18k',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  observations!: string;
}
