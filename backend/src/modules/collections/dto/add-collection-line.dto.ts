import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

export class AddCollectionLineDto {
  @ApiProperty({ description: 'ID del tipo de metal' })
  @IsUUID()
  metalTypeId!: string;

  @ApiProperty({ description: 'ID del quilataje' })
  @IsUUID()
  karatId!: string;

  @ApiProperty({
    description: 'Gramos declarados (Decimal como string, máximo 2 decimales)',
    example: '25.50',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'gramsDeclared debe ser un número positivo con hasta 2 decimales',
  })
  gramsDeclared!: string;
}
