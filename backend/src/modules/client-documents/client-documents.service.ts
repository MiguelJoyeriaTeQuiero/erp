import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '@modules/prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '@storage/storage.interface';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = 'application/pdf';

const DOC_SELECT = {
  id: true,
  clientId: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  deletedAt: true,
  uploadedBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ClientDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async findByClient(clientId: string) {
    await this.assertClientExists(clientId);
    return this.prisma.clientDocument.findMany({
      where: { clientId, deletedAt: null },
      select: DOC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.clientDocument.findFirst({
      where: { id, deletedAt: null },
      select: DOC_SELECT,
    });
    if (!doc) throw new NotFoundException(`Documento con id "${id}" no encontrado`);
    return doc;
  }

  async upload(
    clientId: string,
    file: Express.Multer.File,
    uploadedById: string,
  ) {
    await this.assertClientExists(clientId);
    this.validateFile(file);

    const { storedPath, sizeBytes } = await this.storage.save(
      file.buffer,
      file.originalname,
      `clients/${clientId}`,
    );

    return this.prisma.clientDocument.create({
      data: {
        clientId,
        originalName: file.originalname,
        storedPath,
        mimeType: file.mimetype,
        sizeBytes,
        uploadedById,
      },
      select: DOC_SELECT,
    });
  }

  async download(id: string, res: Response): Promise<void> {
    const doc = await this.prisma.clientDocument.findFirst({
      where: { id, deletedAt: null },
      select: { originalName: true, mimeType: true, storedPath: true },
    });
    if (!doc) throw new NotFoundException(`Documento con id "${id}" no encontrado`);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
    );

    const stream = this.storage.createReadStream(doc.storedPath);
    stream.pipe(res);
  }

  async remove(id: string) {
    const doc = await this.prisma.clientDocument.findFirst({
      where: { id, deletedAt: null },
    });
    if (!doc) throw new NotFoundException(`Documento con id "${id}" no encontrado`);

    return this.prisma.clientDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: DOC_SELECT,
    });
    // Nota: no eliminamos el archivo físico para tener trazabilidad
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertClientExists(clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) throw new NotFoundException(`Cliente con id "${clientId}" no encontrado`);
  }

  private validateFile(file: Express.Multer.File) {
    if (file.mimetype !== ALLOWED_MIME) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Solo se aceptan PDFs (recibido: ${file.mimetype})`,
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `El archivo supera el tamaño máximo de 10 MB (recibido: ${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      );
    }
  }
}
