import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ enum: ClientType, example: ClientType.COMPANY, description: 'Tipo de cliente' })
  @IsEnum(ClientType, { message: 'El tipo debe ser COMPANY o INDIVIDUAL' })
  type!: ClientType;

  @ApiProperty({ example: 'Joyería Central SL', description: 'Nombre comercial' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre comercial es obligatorio' })
  commercialName!: string;

  @ApiProperty({ example: 'Joyería Central Sociedad Limitada', description: 'Razón social' })
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  legalName!: string;

  @ApiProperty({ example: 'B12345678', description: 'NIF/NIE/CIF único' })
  @IsString()
  @IsNotEmpty({ message: 'El NIF/CIF es obligatorio' })
  @Matches(/^[A-Z0-9]{7,12}$/, {
    message: 'El NIF/CIF debe tener entre 7 y 12 caracteres alfanuméricos en mayúsculas',
  })
  taxId!: string;

  @ApiProperty({ example: '+34 922 123 456' })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  phone!: string;

  @ApiProperty({ example: 'Calle Mayor 1, 38001 Santa Cruz de Tenerife' })
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  address!: string;

  @ApiProperty({ example: 'Juan García' })
  @IsString()
  @IsNotEmpty({ message: 'La persona de contacto es obligatoria' })
  contactPerson!: string;

  @ApiProperty({ example: 'uuid-de-la-categoria', description: 'ID de la categoría de cliente' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: 'Observaciones adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}
