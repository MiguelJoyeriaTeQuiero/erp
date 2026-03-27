import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * IMPORTANTE: /entity/:entityType/:entityId debe declararse ANTES que cualquier /:id
   * para evitar que NestJS interprete "entity" como un parámetro UUID.
   */
  @Get('entity/:entityType/:entityId')
  @ApiOperation({
    summary: 'Historial de auditoría de una entidad',
    description:
      'Devuelve todos los eventos de auditoría de una entidad específica, ' +
      'ordenados cronológicamente (ascendente). Accesible por cualquier usuario autenticado.',
  })
  @ApiParam({ name: 'entityType', description: 'Tipo de entidad (ej: closure, client, collection)' })
  @ApiParam({ name: 'entityId', description: 'ID de la entidad' })
  @ApiResponse({ status: 200, description: 'Lista de eventos de auditoría para la entidad' })
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(entityType, entityId);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({
    summary: 'Listar registros de auditoría',
    description: 'Lista paginada con filtros. Solo accesible por administradores.',
  })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiResponse({ status: 200, description: 'Lista paginada de registros de auditoría' })
  findAll(@Query() filters: FilterAuditDto) {
    return this.auditService.findAll(filters);
  }
}
