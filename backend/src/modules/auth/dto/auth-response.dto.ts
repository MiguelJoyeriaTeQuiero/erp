import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Token de acceso JWT (expira en 15 min)' })
  accessToken!: string;

  @ApiProperty({ description: 'Token de refresco JWT (expira en 7 días)' })
  refreshToken!: string;

  @ApiProperty({ type: UserProfileDto, description: 'Datos del usuario autenticado' })
  user!: UserProfileDto;
}
