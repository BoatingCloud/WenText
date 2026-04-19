import { StorageAdapter, StorageConfig } from './base.js';
import { LocalStorageAdapter, LocalStorageConfig } from './local.js';
import { MinioStorageAdapter, MinioStorageConfig } from './minio.js';
import { SftpStorageAdapter, SftpStorageConfig } from './sftp.js';
import { MirroredStorageAdapter } from './mirrored.js';
import { StorageError } from '../utils/errors.js';

export type StorageAdapterConfig =
  | LocalStorageConfig
  | MinioStorageConfig
  | SftpStorageConfig;

export class StorageFactory {
  private static adapters: Map<string, StorageAdapter> = new Map();

  static create(config: StorageAdapterConfig): StorageAdapter {
    switch (config.type) {
      case 'local':
        return new LocalStorageAdapter(config as LocalStorageConfig);
      case 'minio':
      case 's3':
        return new MinioStorageAdapter(config as MinioStorageConfig);
      case 'sftp':
        return new SftpStorageAdapter(config as SftpStorageConfig);
      default:
        throw new StorageError('Unsupported storage type');
    }
  }

  static async getAdapter(repositoryId: string, config: StorageAdapterConfig): Promise<StorageAdapter> {
    const key = `${repositoryId}:${config.type}`;
    let adapter = this.adapters.get(key);

    if (!adapter) {
      adapter = this.create(config);
      await adapter.connect();
      this.adapters.set(key, adapter);
    }

    return adapter;
  }

  static async removeAdapter(repositoryId: string): Promise<void> {
    for (const [key, adapter] of this.adapters.entries()) {
      if (key.startsWith(repositoryId)) {
        await adapter.disconnect();
        this.adapters.delete(key);
      }
    }
  }

  static async disconnectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }
}

export * from './base.js';
export * from './local.js';
export * from './minio.js';
export * from './sftp.js';
export * from './mirrored.js';
