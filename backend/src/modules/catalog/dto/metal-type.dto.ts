import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateMetalTypeDto {
  @ApiProperty({ example: 'Platino', description: 'Nombre del metal' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  @ApiProperty({ example: 'PLATINUM', description: 'Código único en mayúsculas' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z_]+$/, { message: 'El código debe contener solo letras mayúsculas y guiones bajos' })
  code!: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}

export class UpdateMetalTypeDto extends PartialType(CreateMetalTypeDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
