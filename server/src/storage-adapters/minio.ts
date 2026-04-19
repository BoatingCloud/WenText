import * as Minio from 'minio';
import { Readable } from 'stream';
import { StorageAdapter, StorageFile, StorageConfig, WriteOptions, ReadOptions } from './base.js';
import { StorageError } from '../utils/errors.js';

export interface MinioStorageConfig extends StorageConfig {
  type: 'minio' | 's3';
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

export class MinioStorageAdapter extends StorageAdapter {
  private client: Minio.Client;
  private bucket: string;

  constructor(config: MinioStorageConfig) {
    super(config);
    this.bucket = config.bucket;

    this.client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });
  }

  async connect(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async disconnect(): Promise<void> {
    // No-op for MinIO
  }

  private getObjectName(path: string): string {
    return this.normalizePath(path).replace(/^\//, '');
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, this.getObjectName(path));
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async stat(path: string): Promise<StorageFile> {
    const objectName = this.getObjectName(path);
    const stats = await this.client.statObject(this.bucket, objectName);
    const name = objectName.split('/').pop() || objectName;

    return {
      name,
      path,
      size: stats.size,
      isDirectory: false,
      mimeType: stats.metaData?.['content-type'],
      modifiedAt: stats.lastModified,
    };
  }

  async list(dirPath: string): Promise<StorageFile[]> {
    const prefix = this.getObjectName(dirPath);
    const normalizedPrefix = prefix ? `${prefix}/` : '';
    const files: StorageFile[] = [];

    const stream = this.client.listObjectsV2(this.bucket, normalizedPrefix, false);

    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          const relativePath = obj.name.replace(normalizedPrefix, '');
          files.push({
            name: relativePath.split('/')[0],
            path: obj.name,
            size: obj.size || 0,
            isDirectory: obj.name.endsWith('/'),
            modifiedAt: obj.lastModified || new Date(),
          });
        } else if (obj.prefix) {
          const name = obj.prefix.replace(normalizedPrefix, '').replace(/\/$/, '');
          files.push({
            name,
            path: obj.prefix,
            size: 0,
            isDirectory: true,
            modifiedAt: new Date(),
          });
        }
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(files));
    });
  }

  async read(path: string, options?: ReadOptions): Promise<Buffer> {
    const objectName = this.getObjectName(path);
    const chunks: Buffer[] = [];

    let stream: Readable;
    if (options?.range) {
      stream = await this.client.getPartialObject(
        this.bucket,
        objectName,
        options.range.start,
        options.range.end - options.range.start + 1
      );
    } else {
      stream = await this.client.getObject(this.bucket, objectName);
    }

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async readStream(path: string, options?: ReadOptions): Promise<Readable> {
    const objectName = this.getObjectName(path);

    if (options?.range) {
      return this.client.getPartialObject(
        this.bucket,
        objectName,
        options.range.start,
        options.range.end - options.range.start + 1
      );
    }

    return this.client.getObject(this.bucket, objectName);
  }

  async write(path: string, data: Buffer | Readable, options?: WriteOptions): Promise<void> {
    const objectName = this.getObjectName(path);

    if (!options?.overwrite) {
      const exists = await this.exists(path);
      if (exists) {
        throw new StorageError('Object already exists');
      }
    }

    if (data instanceof Buffer) {
      await this.client.putObject(this.bucket, objectName, data);
    } else {
      await this.client.putObject(this.bucket, objectName, data);
    }
  }

  async delete(path: string): Promise<void> {
    const objectName = this.getObjectName(path);
    await this.client.removeObject(this.bucket, objectName);
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    await this.copy(sourcePath, targetPath);
    await this.delete(sourcePath);
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    const sourceObject = this.getObjectName(sourcePath);
    const targetObject = this.getObjectName(targetPath);

    await this.client.copyObject(
      this.bucket,
      targetObject,
      `/${this.bucket}/${sourceObject}`,
      new Minio.CopyConditions()
    );
  }

  async createDirectory(dirPath: string): Promise<void> {
    const objectName = this.getObjectName(dirPath);
    const folderMarker = objectName.endsWith('/') ? objectName : `${objectName}/`;
    await this.client.putObject(this.bucket, folderMarker, Buffer.from(''));
  }

  async deleteDirectory(dirPath: string, recursive = false): Promise<void> {
    if (!recursive) {
      const folderMarker = this.getObjectName(dirPath);
      await this.client.removeObject(this.bucket, folderMarker.endsWith('/') ? folderMarker : `${folderMarker}/`);
      return;
    }

    const objects = await this.list(dirPath);
    for (const obj of objects) {
      if (obj.isDirectory) {
        await this.deleteDirectory(obj.path, true);
      } else {
        await this.delete(obj.path);
      }
    }

    await this.client.removeObject(this.bucket, `${this.getObjectName(dirPath)}/`);
  }
}
