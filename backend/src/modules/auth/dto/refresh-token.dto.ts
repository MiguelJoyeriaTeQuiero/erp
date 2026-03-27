import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Token de refresco JWT' })
  @IsString({ message: 'El token de refresco debe ser texto' })
  @IsNotEmpty({ message: 'El token de refresco es obligatorio' })
  refreshToken!: string;
}
