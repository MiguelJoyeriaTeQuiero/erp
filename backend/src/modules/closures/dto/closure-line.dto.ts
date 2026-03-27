import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, Matches } from 'class-validator';

export class CreateClosureLineDto {
  @ApiProperty({ description: 'ID del tipo de metal' })
  @IsUUID()
  metalTypeId!: string;

  @ApiProperty({ description: 'ID del quilataje' })
  @IsUUID()
  karatId!: string;

  @ApiProperty({ example: '100.50', description: 'Gramos pactados (Decimal como string)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Los gramos deben ser un número positivo con hasta 2 decimales' })
  grams!: string;

  @ApiPropertyOptional({ description: 'Orden de la línea' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}

export class UpdateClosureLineDto extends PartialType(CreateClosureLineDto) {}
