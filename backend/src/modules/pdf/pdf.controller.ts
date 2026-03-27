import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Res,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '@storage/storage.interface';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from '@common/types';

@ApiTags('PDF / Albaranes')
@ApiBearerAuth()
@Controller('closures')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /**
   * GET /closures/:closureId/delivery-note
   * Descarga el albarán PDF del cierre. Si no existe, lo genera primero.
   */
  @Get(':closureId/delivery-note')
  @ApiOperation({
    summary: 'Descargar albarán de cierre',
    description:
      'Descarga el albarán PDF del cierre. Si aún no se ha generado, lo genera automáticamente.',
  })
  @ApiParam({ name: 'closureId', description: 'ID del cierre' })
  @ApiResponse({ status: 200, description: 'Fichero PDF (application/pdf)' })
  @ApiResponse({ status: 404, description: 'Cierre no encontrado' })
  async downloadDeliveryNote(
    @Param('closureId', ParseUUIDPipe) closureId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    // Genera si no existe
    let note = await this.prisma.deliveryNote.findUnique({ where: { closureId } });
    if (!note) {
      await this.pdfService.generateDeliveryNote(closureId, user.id);
      note = await this.prisma.deliveryNote.findUniqueOrThrow({ where: { closureId } });
    }

    if (!this.storage.exists(note.filePath)) {
      // Archivo eliminado del disco — regenerar
      await this.pdfService.generateDeliveryNote(closureId, user.id);
      note = await this.prisma.deliveryNote.findUniqueOrThrow({ where: { closureId } });
    }

    const filename = `${note.code}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const stream = this.storage.createReadStream(note.filePath);
    stream.pipe(res);
  }

  /**
   * POST /closures/:closureId/delivery-note/regenerate
   * Fuerza la regeneración del albarán (por ejemplo, tras un cambio en los datos).
   * Solo admin y oficina.
   */
  @Post(':closureId/delivery-note/regenerate')
  @Roles('admin', 'oficina')
  @ApiOperation({
    summary: 'Regenerar albarán de cierre',
    description: 'Fuerza la regeneración del albarán PDF. Solo admin y oficina.',
  })
  @ApiParam({ name: 'closureId', description: 'ID del cierre' })
  @ApiResponse({ status: 200, description: 'Albarán regenerado correctamente' })
  @ApiResponse({ status: 404, description: 'Cierre no encontrado' })
  async regenerateDeliveryNote(
    @Param('closureId', ParseUUIDPipe) closureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // Verificar que el cierre existe
    const closure = await this.prisma.dealClosure.findUnique({
      where: { id: closureId },
      select: { id: true, code: true },
    });
    if (!closure) {
      throw new NotFoundException(`Cierre ${closureId} no encontrado`);
    }

    await this.pdfService.generateDeliveryNote(closureId, user.id);

    const note = await this.prisma.deliveryNote.findUniqueOrThrow({ where: { closureId } });
    return { code: note.code, filePath: note.filePath, status: note.status };
  }
}
