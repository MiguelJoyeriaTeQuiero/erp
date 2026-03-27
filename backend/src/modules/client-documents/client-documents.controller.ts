import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { ClientDocumentsService } from './client-documents.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthUser } from '@common/types';

@ApiTags('Documentos de Cliente')
@ApiBearerAuth()
@Controller('clients/:clientId/documents')
export class ClientDocumentsController {
  constructor(private readonly documentsService: ClientDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar documentos del cliente' })
  @ApiResponse({ status: 200, description: 'Lista de documentos' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  findAll(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.documentsService.findByClient(clientId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Descargar documento (streaming)' })
  @ApiResponse({ status: 200, description: 'Archivo PDF' })
  @ApiResponse({ status: 404, description: 'Documento no encontrado' })
  async download(
    @Param('clientId', ParseUUIDPipe) _clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    await this.documentsService.download(id, res);
  }

  @Post('upload')
  @Roles('admin', 'oficina', 'comercial')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — multer rechaza antes del controller
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo PDF (máx. 10 MB)' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Subir documento PDF para el cliente' })
  @ApiResponse({ status: 201, description: 'Documento subido' })
  @ApiResponse({ status: 400, description: 'Tipo de archivo o tamaño inválido' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  upload(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Se requiere un archivo PDF');
    return this.documentsService.upload(clientId, file, user.id);
  }

  @Delete(':id')
  @Roles('admin', 'oficina')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar documento (soft delete)' })
  @ApiResponse({ status: 200, description: 'Documento eliminado' })
  @ApiResponse({ status: 404, description: 'Documento no encontrado' })
  remove(
    @Param('clientId', ParseUUIDPipe) _clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.remove(id);
  }
}
