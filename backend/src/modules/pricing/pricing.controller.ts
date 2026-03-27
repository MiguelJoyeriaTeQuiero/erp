import {
  Controller,
  Get,
  Post,
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
  ApiQuery,
} from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { CreateRateDto } from './dto/create-rate.dto';
import { FilterRatesDto, CurrentRateQueryDto } from './dto/filter-rates.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';

@ApiTags('Tarifas de Precio')
@ApiBearerAuth()
@Controller('pricing/rates')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  /**
   * IMPORTANTE: La ruta /current debe ir antes de /:id para que NestJS
   * no interprete "current" como un UUID.
   */

  @Get('current')
  @ApiOperation({
    summary: 'Tarifas vigentes en este momento',
    description:
      'Devuelve las tarifas activas cuyo período de validez cubre el momento actual. ' +
      'Filtra opcionalmente por metal, quilataje o categoría.',
  })
  @ApiQuery({ name: 'metalTypeId', required: false })
  @ApiQuery({ name: 'karatId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiResponse({ status: 200, description: 'Tarifas vigentes' })
  findCurrent(@Query() query: CurrentRateQueryDto) {
    return this.pricingService.findCurrent(query);
  }

  @Get('history')
  @Roles('admin')
  @ApiOperation({
    summary: 'Historial de tarifas para una combinación metal+quilataje+categoría',
    description: 'Requiere los tres parámetros para filtrar el historial completo.',
  })
  @ApiQuery({ name: 'metalTypeId', required: true })
  @ApiQuery({ name: 'karatId', required: true })
  @ApiQuery({ name: 'categoryId', required: true })
  @ApiResponse({ status: 200, description: 'Historial ordenado de más reciente a más antiguo' })
  findHistory(
    @Query('metalTypeId', ParseUUIDPipe) metalTypeId: string,
    @Query('karatId', ParseUUIDPipe) karatId: string,
    @Query('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.pricingService.findHistory(metalTypeId, karatId, categoryId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tarifas con filtros y paginación (incluye históricas)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de tarifas' })
  findAll(@Query() filters: FilterRatesDto) {
    return this.pricingService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tarifa por ID' })
  @ApiResponse({ status: 200, description: 'Tarifa encontrada' })
  @ApiResponse({ status: 404, description: 'Tarifa no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({
    summary: 'Crear tarifa manual',
    description:
      'Crea una nueva tarifa para la combinación indicada e invalida la anterior activa. ' +
      'Solo accesible a administradores.',
  })
  @ApiResponse({ status: 201, description: 'Tarifa creada y anterior invalidada' })
  @ApiResponse({ status: 400, description: 'Quilataje no pertenece al metal indicado' })
  @ApiResponse({ status: 404, description: 'Metal, quilataje o categoría no encontrado' })
  create(@Body() dto: CreateRateDto, @CurrentUser() user: AuthUser) {
    return this.pricingService.create(dto, user.id);
  }
}
