import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { StorageService, StoredFile } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor(configService: ConfigService) {
    this.basePath = path.resolve(
      configService.get<string>('STORAGE_LOCAL_PATH') ?? './uploads',
    );
    fs.mkdirSync(this.basePath, { recursive: true });
    this.logger.log(`Almacenamiento local en: ${this.basePath}`);
  }

  async save(buffer: Buffer, originalName: string, folder: string): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const dir = path.join(this.basePath, folder);
    fs.mkdirSync(dir, { recursive: true });

    const fullPath = path.join(dir, filename);
    await fs.promises.writeFile(fullPath, buffer);

    // storedPath relativo a basePath para portabilidad
    const storedPath = path.join(folder, filename).replace(/\\/g, '/');
    return { storedPath, sizeBytes: buffer.length };
  }

  createReadStream(storedPath: string): Readable {
    const fullPath = path.join(this.basePath, storedPath);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Archivo no encontrado en el almacenamiento');
    }
    return fs.createReadStream(fullPath);
  }

  async delete(storedPath: string): Promise<void> {
    const fullPath = path.join(this.basePath, storedPath);
    try {
      await fs.promises.unlink(fullPath);
    } catch {
      this.logger.warn(`No se pudo eliminar archivo: ${fullPath}`);
    }
  }

  exists(storedPath: string): boolean {
    return fs.existsSync(path.join(this.basePath, storedPath));
  }
}
