import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { ConversionService } from '@domain/conversion.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';
import { RejectConversionDto } from './dto/reject-conversion.dto';

const CONVERSION_INCLUDE = {
  collectionLine: {
    select: {
      id: true,
      gramsDeclared: true,
      puritySnapshot: true,
      metalType: { select: { id: true, name: true, code: true } },
      karat: { select: { id: true, label: true } },
    },
  },
  closureLine: {
    select: {
      id: true,
      grams: true,
      puritySnapshot: true,
      metalType: { select: { id: true, name: true, code: true } },
      karat: { select: { id: true, label: true } },
    },
  },
  sourceKarat: { select: { id: true, label: true, purity: true } },
  targetKarat: { select: { id: true, label: true, purity: true } },
  appliedBy: { select: { id: true, name: true } },
} satisfies Prisma.ConversionInclude;

/**
 * Gestión de conversiones de quilataje.
 *
 * Las conversiones se crean automáticamente por IncidentGeneratorService
 * cuando una línea de recogida tiene un quilataje distinto al pactado en el cierre.
 * El equipo de oficina las revisa y aprueba/rechaza manualmente.
 */
@ApiTags('Conversiones')
@ApiBearerAuth()
@Controller()
export class ConversionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversionService: ConversionService,
  ) {}

  /**
   * Lista todas las conversiones de un cierre (en cualquier estado).
   */
  @Get('closures/:closureId/conversions')
  @ApiOperation({
    summary: 'Listar conversiones de un cierre',
    description: 'Devuelve todas las conversiones (PENDING, APPLIED, REJECTED) del cierre.',
  })
  @ApiParam({ name: 'closureId', description: 'ID del cierre' })
  @ApiResponse({ status: 200, description: 'Lista de conversiones' })
  @ApiResponse({ status: 404, description: 'Cierre no encontrado' })
  async findForClosure(@Param('closureId', ParseUUIDPipe) closureId: string) {
    // Verificar que el cierre existe
    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: closureId },
      select: { id: true },
    });
    if (!closure) {
      throw new NotFoundException(`Cierre con id "${closureId}" no encontrado`);
    }

    return this.prisma.conversion.findMany({
      where: { closureLine: { closureId } },
      include: CONVERSION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Aplica una conversión PENDING: los gramos equivalentes calculados
   * se contabilizan como material recogido para la línea de cierre correspondiente.
   */
  @Post('conversions/:id/apply')
  @Roles('admin', 'oficina')
  @ApiOperation({
    summary: 'Aprobar una conversión',
    description:
      'Marca la conversión como APPLIED. Los gramos equivalentes se suman al total recogido ' +
      'para la línea de cierre, lo que puede desbloquear la transición a PENDING_VALIDATION.',
  })
  @ApiParam({ name: 'id', description: 'ID de la conversión' })
  @ApiResponse({ status: 200, description: 'Conversión aprobada' })
  @ApiResponse({ status: 400, description: 'La conversión no está en estado PENDING' })
  @ApiResponse({ status: 404, description: 'Conversión no encontrada' })
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversionService.applyConversion(id, user.id);
  }

  /**
   * Rechaza una conversión PENDING: el material recogido con ese quilataje
   * NO se contabilizará como equivalente. El motivo es obligatorio.
   */
  @Post('conversions/:id/reject')
  @Roles('admin', 'oficina')
  @ApiOperation({
    summary: 'Rechazar una conversión',
    description:
      'Marca la conversión como REJECTED. El motivo es obligatorio para trazabilidad. ' +
      'El material no se contabiliza como recogido.',
  })
  @ApiParam({ name: 'id', description: 'ID de la conversión' })
  @ApiResponse({ status: 200, description: 'Conversión rechazada' })
  @ApiResponse({ status: 400, description: 'La conversión no está en estado PENDING o falta motivo' })
  @ApiResponse({ status: 404, description: 'Conversión no encontrada' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectConversionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversionService.rejectConversion(id, user.id, dto.reason);
  }
}
