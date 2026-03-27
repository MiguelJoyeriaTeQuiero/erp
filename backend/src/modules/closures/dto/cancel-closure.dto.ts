import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CancelClosureDto {
  @ApiProperty({ description: 'Motivo de cancelación (obligatorio para trazabilidad)' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de cancelación es obligatorio' })
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  reason!: string;
}
