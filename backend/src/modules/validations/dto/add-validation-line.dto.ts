import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class AddValidationLineDto {
  @ApiPropertyOptional({
    description: 'ID de la línea de cierre validada (referencia al material pactado)',
  })
  @IsOptional()
  @IsUUID()
  closureLineId?: string;

  @ApiPropertyOptional({
    description: 'ID de la línea de recogida validada',
  })
  @IsOptional()
  @IsUUID()
  collectionLineId?: string;

  @ApiProperty({
    description: 'Gramos validados físicamente (Decimal como string, 2 decimales)',
    example: '24.85',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'gramsValidated debe ser un número positivo con hasta 2 decimales',
  })
  gramsValidated!: string;

  @ApiProperty({ description: 'ID del quilataje verificado físicamente' })
  @IsUUID()
  karatValidatedId!: string;

  @ApiPropertyOptional({
    description:
      'Pureza medida físicamente (Decimal como string, 4 decimales). ' +
      'Si se omite, se usa la pureza teórica del quilataje. ' +
      'Una pureza < 0.2000 generará incidencia SCRAP al rechazar la sesión.',
    example: '0.7500',
  })
  @IsOptional()
  @IsString()
  @Matches(/^0?\.\d{1,4}$|^1(\.0{1,4})?$/, {
    message: 'purityValidated debe ser un decimal entre 0 y 1 con hasta 4 decimales',
  })
  purityValidated?: string;

  @ApiPropertyOptional({
    description:
      'Observación obligatoria si hay corrección de gramos (diferencia > 0.05g) ' +
      'o de quilataje respecto a lo declarado.',
    minLength: 5,
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  observation?: string;
}
