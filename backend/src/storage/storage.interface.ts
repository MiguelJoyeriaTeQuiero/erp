import { Readable } from 'stream';

export interface StoredFile {
  storedPath: string;
  sizeBytes: number;
}

export interface StorageService {
  save(buffer: Buffer, originalName: string, folder: string): Promise<StoredFile>;
  createReadStream(storedPath: string): Readable;
  delete(storedPath: string): Promise<void>;
  exists(storedPath: string): boolean;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
