import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../types';

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class PaginatedResponseDto<T> {
  data!: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

/**
 * Genera la respuesta paginada con meta calculado.
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  const dto = new PaginatedResponseDto<T>();
  dto.data = data;
  dto.meta = {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
  return dto;
}
