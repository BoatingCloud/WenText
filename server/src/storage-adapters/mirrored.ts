import { Readable } from 'stream';
import { StorageAdapter, StorageFile, ReadOptions, WriteOptions, StorageConfig } from './base.js';
import { logger } from '../config/logger.js';

export class MirroredStorageAdapter extends StorageAdapter {
  private readonly primary: StorageAdapter;
  private readonly backup: StorageAdapter;
  private readonly repoId: string;

  constructor(primary: StorageAdapter, backup: StorageAdapter, repoId: string) {
    super({ type: 'mirrored', basePath: '' } as StorageConfig);
    this.primary = primary;
    this.backup = backup;
    this.repoId = repoId;
  }

  async connect(): Promise<void> {
    // Underlying adapters are created/connected by StorageFactory.
  }

  async disconnect(): Promise<void> {
    // Underlying adapters are managed by StorageFactory lifecycle.
  }

  async exists(path: string): Promise<boolean> {
    const primaryExists = await this.primary.exists(path);
    if (primaryExists) return true;
    return this.backup.exists(path);
  }

  async stat(path: string): Promise<StorageFile> {
    try {
      return await this.primary.stat(path);
    } catch {
      return this.backup.stat(path);
    }
  }

  async list(path: string): Promise<StorageFile[]> {
    return this.primary.list(path);
  }

  async read(path: string, options?: ReadOptions): Promise<Buffer> {
    try {
      return await this.primary.read(path, options);
    } catch (primaryError) {
      logger.warn('Primary storage read failed, fallback to backup', {
        repoId: this.repoId,
        path,
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });
      return this.backup.read(path, options);
    }
  }

  async readStream(path: string, options?: ReadOptions): Promise<Readable> {
    try {
      return await this.primary.readStream(path, options);
    } catch (primaryError) {
      logger.warn('Primary storage stream read failed, fallback to backup', {
        repoId: this.repoId,
        path,
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });
      return this.backup.readStream(path, options);
    }
  }

  async write(path: string, data: Buffer | Readable, options?: WriteOptions): Promise<void> {
    let backupBuffer: Buffer | null = null;
    let sourceData = data;

    if (data instanceof Readable) {
      const chunks: Buffer[] = [];
      sourceData = await new Promise<Buffer>((resolve, reject) => {
        data.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        data.on('end', () => resolve(Buffer.concat(chunks)));
        data.on('error', reject);
      });
    }

    if (Buffer.isBuffer(sourceData)) {
      backupBuffer = sourceData;
    }

    await this.primary.write(path, sourceData, options);

    try {
      await this.backup.write(path, backupBuffer || sourceData, { ...options, overwrite: true });
    } catch (backupError) {
      logger.error('Backup storage write failed', {
        repoId: this.repoId,
        path,
        error: backupError instanceof Error ? backupError.message : String(backupError),
      });
    }
  }

  async delete(path: string): Promise<void> {
    await this.primary.delete(path);
    try {
      await this.backup.delete(path);
    } catch {
      // ignore backup delete failures
    }
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    await this.primary.move(sourcePath, targetPath);
    try {
      await this.backup.move(sourcePath, targetPath);
    } catch {
      // ignore backup move failures
    }
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    await this.primary.copy(sourcePath, targetPath);
    try {
      await this.backup.copy(sourcePath, targetPath);
    } catch {
      // ignore backup copy failures
    }
  }

  async createDirectory(path: string): Promise<void> {
    await this.primary.createDirectory(path);
    try {
      await this.backup.createDirectory(path);
    } catch {
      // ignore backup directory failures
    }
  }

  async deleteDirectory(path: string, recursive = false): Promise<void> {
    await this.primary.deleteDirectory(path, recursive);
    try {
      await this.backup.deleteDirectory(path, recursive);
    } catch {
      // ignore backup directory failures
    }
  }
}
