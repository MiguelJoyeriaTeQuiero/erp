import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateKaratDto {
  @ApiProperty({ example: 'uuid-metal-type', description: 'ID del tipo de metal' })
  @IsUUID()
  metalTypeId!: string;

  @ApiProperty({ example: '18k', description: 'Etiqueta del quilataje' })
  @IsString()
  @IsNotEmpty({ message: 'La etiqueta es obligatoria' })
  label!: string;

  @ApiProperty({ example: '0.7500', description: 'Pureza (0.0001 – 1.0000)' })
  @IsString()
  @IsNotEmpty({ message: 'La pureza es obligatoria' })
  purity!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isCommon?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}

export class UpdateKaratDto extends PartialType(CreateKaratDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
