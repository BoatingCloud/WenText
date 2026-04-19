import fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import mime from 'mime-types';
import { StorageAdapter, StorageFile, StorageConfig, WriteOptions, ReadOptions } from './base.js';
import { StorageError } from '../utils/errors.js';

export interface LocalStorageConfig extends StorageConfig {
  type: 'local';
  basePath: string;
}

export class LocalStorageAdapter extends StorageAdapter {
  private basePath: string;
  private resolvedBasePath: string;

  constructor(config: LocalStorageConfig) {
    super(config);
    this.basePath = config.basePath;
    // 解析为绝对路径，避免 startsWith 检查失败
    this.resolvedBasePath = path.resolve(config.basePath);
  }

  async connect(): Promise<void> {
    if (!existsSync(this.basePath)) {
      await fs.mkdir(this.basePath, { recursive: true });
    }
  }

  async disconnect(): Promise<void> {
    // No-op for local storage
  }

  private getFullPath(relativePath: string): string {
    const normalized = this.normalizePath(relativePath);
    const fullPath = path.join(this.resolvedBasePath, normalized);

    if (!fullPath.startsWith(this.resolvedBasePath)) {
      throw new StorageError('Invalid path: path traversal attempt detected');
    }

    return fullPath;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(this.getFullPath(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<StorageFile> {
    const fullPath = this.getFullPath(filePath);
    const stats = await fs.stat(fullPath);
    const name = path.basename(filePath);

    return {
      name,
      path: filePath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      mimeType: stats.isFile() ? mime.lookup(name) || undefined : undefined,
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime,
    };
  }

  async list(dirPath: string): Promise<StorageFile[]> {
    const fullPath = this.getFullPath(dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files: StorageFile[] = [];

    for (const entry of entries) {
      const entryPath = this.joinPath(dirPath, entry.name);
      const stats = await fs.stat(path.join(fullPath, entry.name));

      files.push({
        name: entry.name,
        path: entryPath,
        size: stats.size,
        isDirectory: entry.isDirectory(),
        mimeType: entry.isFile() ? mime.lookup(entry.name) || undefined : undefined,
        modifiedAt: stats.mtime,
        createdAt: stats.birthtime,
      });
    }

    return files;
  }

  async read(filePath: string, _options?: ReadOptions): Promise<Buffer> {
    const fullPath = this.getFullPath(filePath);
    return fs.readFile(fullPath);
  }

  async readStream(filePath: string, options?: ReadOptions): Promise<Readable> {
    const fullPath = this.getFullPath(filePath);

    if (options?.range) {
      return createReadStream(fullPath, {
        start: options.range.start,
        end: options.range.end,
      });
    }

    return createReadStream(fullPath);
  }

  async write(filePath: string, data: Buffer | Readable, options?: WriteOptions): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    const dir = path.dirname(fullPath);

    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    if (!options?.overwrite && existsSync(fullPath)) {
      throw new StorageError('File already exists');
    }

    if (Buffer.isBuffer(data)) {
      await fs.writeFile(fullPath, data);
    } else {
      return new Promise((resolve, reject) => {
        const writeStream = createWriteStream(fullPath);
        data.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    await fs.unlink(fullPath);
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    const sourceFullPath = this.getFullPath(sourcePath);
    const targetFullPath = this.getFullPath(targetPath);
    const targetDir = path.dirname(targetFullPath);

    if (!existsSync(targetDir)) {
      await fs.mkdir(targetDir, { recursive: true });
    }

    await fs.rename(sourceFullPath, targetFullPath);
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    const sourceFullPath = this.getFullPath(sourcePath);
    const targetFullPath = this.getFullPath(targetPath);
    const targetDir = path.dirname(targetFullPath);

    if (!existsSync(targetDir)) {
      await fs.mkdir(targetDir, { recursive: true });
    }

    await fs.copyFile(sourceFullPath, targetFullPath);
  }

  async createDirectory(dirPath: string): Promise<void> {
    const fullPath = this.getFullPath(dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async deleteDirectory(dirPath: string, recursive = false): Promise<void> {
    const fullPath = this.getFullPath(dirPath);
    await fs.rm(fullPath, { recursive, force: recursive });
  }
}
