import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
  ApiQuery,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateMetalTypeDto, UpdateMetalTypeDto } from './dto/metal-type.dto';
import { CreateKaratDto, UpdateKaratDto } from './dto/karat.dto';
import { CreateClientCategoryDto, UpdateClientCategoryDto } from './dto/client-category.dto';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Catálogo')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ── Metales ────────────────────────────────────────────────────────────────

  @Get('metals')
  @ApiOperation({ summary: 'Listar tipos de metal' })
  @ApiResponse({ status: 200, description: 'Lista de metales' })
  findAllMetals() {
    return this.catalogService.findAllMetals();
  }

  @Get('metals/:id')
  @ApiOperation({ summary: 'Obtener metal por ID (incluye quilatajes activos)' })
  @ApiResponse({ status: 200, description: 'Metal encontrado' })
  @ApiResponse({ status: 404, description: 'Metal no encontrado' })
  findOneMetal(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findOneMetal(id);
  }

  @Post('metals')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear tipo de metal' })
  @ApiResponse({ status: 201, description: 'Metal creado' })
  @ApiResponse({ status: 409, description: 'Código duplicado' })
  createMetal(@Body() dto: CreateMetalTypeDto) {
    return this.catalogService.createMetal(dto);
  }

  @Patch('metals/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar tipo de metal' })
  @ApiResponse({ status: 200, description: 'Metal actualizado' })
  updateMetal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMetalTypeDto,
  ) {
    return this.catalogService.updateMetal(id, dto);
  }

  @Delete('metals/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar tipo de metal' })
  @ApiResponse({ status: 200, description: 'Metal desactivado' })
  removeMetal(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.removeMetal(id);
  }

  // ── Quilatajes ─────────────────────────────────────────────────────────────

  @Get('karats/common')
  @ApiOperation({ summary: 'Listar quilatajes comunes (isCommon=true)' })
  @ApiResponse({ status: 200, description: 'Quilatajes comunes' })
  findCommonKarats() {
    return this.catalogService.findCommonKarats();
  }

  @Get('karats')
  @ApiOperation({ summary: 'Listar quilatajes activos' })
  @ApiQuery({ name: 'metalTypeId', required: false, description: 'Filtrar por tipo de metal' })
  @ApiResponse({ status: 200, description: 'Lista de quilatajes' })
  findAllKarats(@Query('metalTypeId') metalTypeId?: string) {
    return this.catalogService.findAllKarats(metalTypeId);
  }

  @Get('karats/:id')
  @ApiOperation({ summary: 'Obtener quilataje por ID' })
  @ApiResponse({ status: 200, description: 'Quilataje encontrado' })
  @ApiResponse({ status: 404, description: 'Quilataje no encontrado' })
  findOneKarat(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findOneKarat(id);
  }

  @Post('karats')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear quilataje' })
  @ApiResponse({ status: 201, description: 'Quilataje creado' })
  createKarat(@Body() dto: CreateKaratDto) {
    return this.catalogService.createKarat(dto);
  }

  @Patch('karats/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar quilataje' })
  @ApiResponse({ status: 200, description: 'Quilataje actualizado' })
  updateKarat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKaratDto,
  ) {
    return this.catalogService.updateKarat(id, dto);
  }

  @Delete('karats/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar quilataje' })
  @ApiResponse({ status: 200, description: 'Quilataje desactivado' })
  removeKarat(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.removeKarat(id);
  }

  // ── Categorías de cliente ──────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorías de cliente' })
  @ApiResponse({ status: 200, description: 'Lista de categorías' })
  findAllCategories() {
    return this.catalogService.findAllCategories();
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  @ApiResponse({ status: 200, description: 'Categoría encontrada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  findOneCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findOneCategory(id);
  }

  @Post('categories')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear categoría de cliente' })
  @ApiResponse({ status: 201, description: 'Categoría creada' })
  @ApiResponse({ status: 409, description: 'Nombre o slug duplicado' })
  createCategory(@Body() dto: CreateClientCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar categoría de cliente' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientCategoryDto,
  ) {
    return this.catalogService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar categoría (falla si tiene clientes activos)' })
  @ApiResponse({ status: 200, description: 'Categoría desactivada' })
  @ApiResponse({ status: 409, description: 'Categoría con clientes activos' })
  removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.removeCategory(id);
  }
}
