import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ValidationsService } from './validations.service';
import {
  CreateValidationSessionDto,
  AddValidationLineDto,
  ApproveValidationDto,
  RejectValidationDto,
} from './dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';

/**
 * Rutas bajo /closures/:closureId/validations — creación de sesiones de validación.
 */
@ApiTags('Validaciones')
@ApiBearerAuth()
@Controller('closures/:closureId/validations')
export class ClosureValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar sesiones de validación del cierre' })
  @ApiParam({ name: 'closureId', description: 'ID del cierre' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones de validación' })
  findByClosure(@Param('closureId', ParseUUIDPipe) closureId: string) {
    return this.validationsService.findByClosure(closureId);
  }

  @Post()
  @Roles('admin', 'oficina', 'validador')
  @ApiOperation({
    summary: 'Crear sesión de validación',
    description:
      'Inicia una sesión de validación para el cierre. ' +
      'El cierre debe estar en PENDING_VALIDATION y no tener otra sesión activa. ' +
      'El cierre pasa automáticamente a IN_VALIDATION.',
  })
  @ApiParam({ name: 'closureId', description: 'ID del cierre' })
  @ApiResponse({ status: 201, description: 'Sesión de validación creada' })
  @ApiResponse({ status: 400, description: 'Estado incorrecto o sesión activa ya existente' })
  @ApiResponse({ status: 404, description: 'Cierre no encontrado' })
  create(
    @Param('closureId', ParseUUIDPipe) closureId: string,
    @Body() dto: CreateValidationSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.validationsService.create(closureId, dto, user.id);
  }
}

/**
 * Rutas bajo /validations — operaciones sobre sesiones existentes.
 */
@ApiTags('Validaciones')
@ApiBearerAuth()
@Controller('validations')
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener sesión de validación por ID' })
  @ApiResponse({ status: 200, description: 'Sesión con todas sus líneas e incidencias' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.validationsService.findOne(id);
  }

  @Post(':id/lines')
  @Roles('admin', 'oficina', 'validador')
  @ApiOperation({
    summary: 'Añadir línea validada a la sesión',
    description:
      'Registra el resultado físico de la validación para una línea de material. ' +
      'Si los gramos validados difieren > 0.05g del declarado, o el quilataje difiere, ' +
      'la observación es obligatoria.',
  })
  @ApiResponse({ status: 201, description: 'Línea de validación añadida' })
  @ApiResponse({ status: 400, description: 'Sesión no activa, corrección sin observación o datos inválidos' })
  @ApiResponse({ status: 404, description: 'Sesión o quilataje no encontrado' })
  addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddValidationLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.validationsService.addLine(id, dto, user.id);
  }

  @Post(':id/approve')
  @Roles('admin', 'oficina', 'validador')
  @ApiOperation({
    summary: 'Aprobar sesión de validación',
    description:
      'Marca la sesión como APPROVED. ' +
      'Si el material validado cubre todo lo pactado en el cierre, ' +
      'el cierre transiciona automáticamente a VALIDATED.',
  })
  @ApiResponse({ status: 200, description: 'Sesión aprobada; el cierre puede haber pasado a VALIDATED' })
  @ApiResponse({ status: 400, description: 'Sesión no está en curso' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveValidationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.validationsService.approve(id, dto, user.id);
  }

  @Post(':id/reject')
  @Roles('admin', 'oficina', 'validador')
  @ApiOperation({
    summary: 'Rechazar sesión de validación',
    description:
      'Marca la sesión como REJECTED y genera incidencias automáticas ' +
      '(SCRAP y/o VALIDATION_DISCREPANCY) para cada línea con problemas. ' +
      'El cierre transiciona a WITH_INCIDENTS.',
  })
  @ApiResponse({ status: 200, description: 'Sesión rechazada; incidencias generadas; cierre en WITH_INCIDENTS' })
  @ApiResponse({ status: 400, description: 'Sesión no está en curso o motivo demasiado corto' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectValidationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.validationsService.reject(id, dto, user.id);
  }
}
