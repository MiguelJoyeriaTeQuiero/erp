import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  ResolveIncidentDto,
  FilterIncidentsDto,
} from './dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';

@ApiTags('Incidencias')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar incidencias',
    description: 'Lista paginada con filtros por cierre, tipo, estado y rango de fechas.',
  })
  @ApiQuery({ name: 'closureId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiResponse({ status: 200, description: 'Lista paginada de incidencias' })
  findAll(@Query() filters: FilterIncidentsDto) {
    return this.incidentsService.findAll(filters);
  }

  @Post()
  @Roles('admin', 'oficina', 'validador')
  @ApiOperation({
    summary: 'Crear incidencia manualmente',
    description:
      'Crea una incidencia sobre un cierre. La mayoría de incidencias se generan ' +
      'automáticamente por IncidentGeneratorService, pero este endpoint permite ' +
      'registrar incidencias manuales del tipo DIFFERENCE u otras.',
  })
  @ApiResponse({ status: 201, description: 'Incidencia creada' })
  @ApiResponse({ status: 404, description: 'Cierre, recogida o sesión no encontrada' })
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthUser) {
    return this.incidentsService.create(dto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener incidencia por ID' })
  @ApiResponse({ status: 200, description: 'Incidencia con todas sus relaciones' })
  @ApiResponse({ status: 404, description: 'Incidencia no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'oficina', 'validador')
  @ApiOperation({
    summary: 'Actualizar incidencia',
    description:
      'Permite actualizar la razón y mover el estado a IN_REVIEW. ' +
      'Para resolver o cancelar, usar /resolve y /cancel.',
  })
  @ApiParam({ name: 'id', description: 'ID de la incidencia' })
  @ApiResponse({ status: 200, description: 'Incidencia actualizada' })
  @ApiResponse({ status: 400, description: 'Estado terminal o transición inválida' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.incidentsService.update(id, dto, user.id);
  }

  @Post(':id/resolve')
  @Roles('admin', 'oficina', 'validador')
  @ApiOperation({
    summary: 'Resolver incidencia',
    description:
      'Marca la incidencia como RESOLVED con un motivo de resolución obligatorio. ' +
      'Si todas las incidencias del cierre quedan resueltas, el cierre transiciona ' +
      'automáticamente a PENDING_VALIDATION (desde WITH_INCIDENTS).',
  })
  @ApiParam({ name: 'id', description: 'ID de la incidencia' })
  @ApiResponse({ status: 200, description: 'Incidencia resuelta; el cierre puede haber cambiado de estado' })
  @ApiResponse({ status: 400, description: 'Incidencia ya en estado terminal' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.incidentsService.resolve(id, dto, user.id);
  }

  @Post(':id/cancel')
  @Roles('admin', 'oficina')
  @ApiOperation({
    summary: 'Cancelar incidencia',
    description:
      'Cancela la incidencia (sin resolución — para incidencias duplicadas o erróneas). ' +
      'Si todas las incidencias del cierre quedan resueltas/canceladas, el cierre ' +
      'transiciona a PENDING_VALIDATION.',
  })
  @ApiParam({ name: 'id', description: 'ID de la incidencia' })
  @ApiResponse({ status: 200, description: 'Incidencia cancelada' })
  @ApiResponse({ status: 400, description: 'Incidencia ya en estado terminal' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.incidentsService.cancel(id, user.id);
  }
}
