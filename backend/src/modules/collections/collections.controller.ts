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
import { CollectionsService } from './collections.service';
import { AddCollectionLineDto } from './dto/add-collection-line.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { FilterCollectionsDto } from './dto/filter-collections.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';

/**
 * Rutas bajo /closures/:closureId/collections — creación de recogidas vinculadas a un cierre.
 */
@ApiTags('Recogidas')
@ApiBearerAuth()
@Controller('closures/:closureId/collections')
export class ClosureCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @Roles('admin', 'oficina', 'comercial')
  @ApiOperation({
    summary: 'Crear recogida para un cierre',
    description:
      'Registra una nueva recogida vinculada al cierre indicado. ' +
      'El cierre pasa automáticamente a PENDING_COLLECTION. ' +
      'Roles permitidos: admin, oficina, comercial.',
  })
  @ApiParam({ name: 'closureId', description: 'ID del cierre' })
  @ApiResponse({ status: 201, description: 'Recogida creada' })
  @ApiResponse({ status: 400, description: 'Estado del cierre no permite recogidas' })
  @ApiResponse({ status: 404, description: 'Cierre no encontrado' })
  create(
    @Param('closureId', ParseUUIDPipe) closureId: string,
    @Body() dto: CreateCollectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collectionsService.create(closureId, dto, user.id);
  }
}

/**
 * Rutas bajo /collections — operaciones sobre recogidas existentes.
 */
@ApiTags('Recogidas')
@ApiBearerAuth()
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar recogidas',
    description: 'Lista paginada de recogidas con filtros opcionales.',
  })
  @ApiQuery({ name: 'closureId', required: false })
  @ApiQuery({ name: 'collectorId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiResponse({ status: 200, description: 'Lista paginada de recogidas' })
  findAll(@Query() filters: FilterCollectionsDto) {
    return this.collectionsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener recogida por ID' })
  @ApiResponse({ status: 200, description: 'Recogida encontrada con sus líneas y conversiones' })
  @ApiResponse({ status: 404, description: 'Recogida no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.collectionsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'oficina', 'comercial')
  @ApiOperation({
    summary: 'Actualizar recogida',
    description:
      'Permite actualizar metadata de la recogida. ' +
      'Al enviar isPartial=false se ejecuta el gap-check completo y se actualiza el estado del cierre. ' +
      'No se puede revertir de isPartial=false a true.',
  })
  @ApiResponse({ status: 200, description: 'Recogida actualizada' })
  @ApiResponse({ status: 400, description: 'Estado no permite modificaciones o reversión inválida' })
  @ApiResponse({ status: 404, description: 'Recogida no encontrada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collectionsService.update(id, dto, user.id);
  }

  @Post(':id/lines')
  @Roles('admin', 'oficina', 'comercial')
  @ApiOperation({
    summary: 'Añadir línea de material a una recogida',
    description:
      'Añade un lote de material (metal + quilataje + gramos) a la recogida. ' +
      'Si el metal no está pactado en el cierre se genera incidencia INVALID_MATERIAL. ' +
      'Si el quilataje difiere del pactado se crea una conversión automática.',
  })
  @ApiResponse({ status: 201, description: 'Línea añadida con posibles conversiones/incidencias' })
  @ApiResponse({ status: 400, description: 'Recogida no está en estado REGISTERED o datos inválidos' })
  @ApiResponse({ status: 404, description: 'Recogida o quilataje no encontrado' })
  addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCollectionLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collectionsService.addLine(id, dto, user.id);
  }
}
