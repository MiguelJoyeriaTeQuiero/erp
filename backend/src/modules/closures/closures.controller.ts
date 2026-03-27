import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClosuresService } from './closures.service';
import { CreateClosureDto } from './dto/create-closure.dto';
import { UpdateClosureDto } from './dto/update-closure.dto';
import { FilterClosureDto } from './dto/filter-closure.dto';
import { CreateClosureLineDto, UpdateClosureLineDto } from './dto/closure-line.dto';
import { CancelClosureDto } from './dto/cancel-closure.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';

@ApiTags('Cierres')
@ApiBearerAuth()
@Controller('closures')
export class ClosuresController {
  constructor(private readonly closuresService: ClosuresService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar cierres con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista paginada de cierres' })
  findAll(@Query() filters: FilterClosureDto) {
    return this.closuresService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cierre por ID (con líneas, recogidas e incidencias)' })
  @ApiResponse({ status: 200, description: 'Cierre encontrado' })
  @ApiResponse({ status: 404, description: 'Cierre no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.closuresService.findOne(id);
  }

  @Post()
  @Roles('admin', 'oficina')
  @ApiOperation({ summary: 'Crear cierre en estado Borrador' })
  @ApiResponse({ status: 201, description: 'Cierre creado con código CIE{AA}-{N}' })
  create(@Body() dto: CreateClosureDto, @CurrentUser() user: AuthUser) {
    return this.closuresService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('admin', 'oficina')
  @ApiOperation({ summary: 'Actualizar cierre (solo en estado Borrador)' })
  @ApiResponse({ status: 200, description: 'Cierre actualizado' })
  @ApiResponse({ status: 409, description: 'El cierre no está en estado Borrador' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClosureDto) {
    return this.closuresService.update(id, dto);
  }

  // ── Acciones de estado ─────────────────────────────────────────────────────

  @Post(':id/confirm')
  @Roles('admin', 'oficina')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar cierre',
    description:
      'Congela precios por línea, genera albarán PDF y cambia estado a CONFIRMED. ' +
      'Operación atómica: precio+estado en transacción; PDF generado fuera.',
  })
  @ApiResponse({ status: 200, description: 'Cierre confirmado' })
  @ApiResponse({ status: 400, description: 'Precondiciones no cumplidas' })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.closuresService.confirm(id, user.id);
  }

  @Post(':id/cancel')
  @Roles('admin', 'oficina')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar cierre',
    description:
      'Cancela el cierre. Si tiene adelanto activo, genera incidencia ADVANCE_REFUND automáticamente.',
  })
  @ApiResponse({ status: 200, description: 'Cierre cancelado' })
  @ApiResponse({ status: 422, description: 'Transición de estado no permitida' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelClosureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.closuresService.cancel(id, user.id, dto);
  }

  @Post(':id/complete')
  @Roles('admin', 'oficina')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Completar cierre',
    description:
      'Completa el cierre. Requiere: estado VALIDATED, material 100% validado, sin incidencias abiertas.',
  })
  @ApiResponse({ status: 200, description: 'Cierre completado' })
  @ApiResponse({ status: 400, description: 'No cumple condiciones de cierre' })
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.closuresService.complete(id, user.id);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Resumen de conciliación del cierre',
    description: 'Muestra pactado vs recogido vs validado por línea, con conversiones e incidencias.',
  })
  @ApiResponse({ status: 200, description: 'Resumen de conciliación' })
  getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.closuresService.getSummary(id);
  }

  // ── Líneas (solo DRAFT) ────────────────────────────────────────────────────

  @Post(':id/lines')
  @Roles('admin', 'oficina')
  @ApiOperation({ summary: 'Añadir línea de material al cierre (solo Borrador)' })
  @ApiResponse({ status: 201, description: 'Línea añadida' })
  @ApiResponse({ status: 409, description: 'El cierre no está en Borrador' })
  addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClosureLineDto,
  ) {
    return this.closuresService.addLine(id, dto);
  }

  @Patch(':id/lines/:lineId')
  @Roles('admin', 'oficina')
  @ApiOperation({ summary: 'Actualizar línea del cierre (solo Borrador)' })
  @ApiResponse({ status: 200, description: 'Línea actualizada' })
  updateLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateClosureLineDto,
  ) {
    return this.closuresService.updateLine(id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @Roles('admin', 'oficina')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar línea del cierre (solo Borrador)' })
  @ApiResponse({ status: 200, description: 'Línea eliminada' })
  removeLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.closuresService.removeLine(id, lineId);
  }
}
