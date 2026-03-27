import { Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdvancesService } from './advances.service';
import { CreateAdvanceDto } from './dto/create-advance.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';

@ApiTags('Adelantos')
@ApiBearerAuth()
@Controller('closures/:closureId/advance')
export class AdvancesController {
  constructor(private readonly advancesService: AdvancesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener adelanto del cierre' })
  @ApiResponse({ status: 200, description: 'Adelanto o null si no existe' })
  @ApiResponse({ status: 404, description: 'Cierre no encontrado' })
  findOne(@Param('closureId', ParseUUIDPipe) closureId: string) {
    return this.advancesService.findByClosure(closureId);
  }

  @Post()
  @Roles('admin', 'oficina')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar adelanto',
    description:
      'Registra un adelanto sobre el cierre. ' +
      'Máximo 1 por cierre, máximo 75% del importe total. ' +
      'Guarda snapshot de precio/gramo y gramos totales en el momento del adelanto.',
  })
  @ApiResponse({ status: 201, description: 'Adelanto registrado, cierre pasa a WITH_ADVANCE' })
  @ApiResponse({ status: 400, description: 'Importe supera el 75% del total' })
  @ApiResponse({ status: 409, description: 'Ya existe un adelanto activo para este cierre' })
  create(
    @Param('closureId', ParseUUIDPipe) closureId: string,
    @Body() dto: CreateAdvanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.advancesService.create(closureId, dto, user.id);
  }
}
