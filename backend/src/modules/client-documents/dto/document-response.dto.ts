import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() deletedAt?: Date | null;
  @ApiProperty() uploadedBy!: { id: string; name: string };
}
