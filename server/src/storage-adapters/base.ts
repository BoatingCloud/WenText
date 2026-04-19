import { Readable } from 'stream';

export interface StorageFile {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  mimeType?: string;
  modifiedAt: Date;
  createdAt?: Date;
}

export interface StorageConfig {
  type: string;
  basePath: string;
  [key: string]: unknown;
}

export interface WriteOptions {
  overwrite?: boolean;
  encrypt?: boolean;
}

export interface ReadOptions {
  decrypt?: boolean;
  range?: { start: number; end: number };
}

export abstract class StorageAdapter {
  protected config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract exists(path: string): Promise<boolean>;
  abstract stat(path: string): Promise<StorageFile>;
  abstract list(path: string): Promise<StorageFile[]>;

  abstract read(path: string, options?: ReadOptions): Promise<Buffer>;
  abstract readStream(path: string, options?: ReadOptions): Promise<Readable>;

  abstract write(path: string, data: Buffer | Readable, options?: WriteOptions): Promise<void>;

  abstract delete(path: string): Promise<void>;
  abstract move(sourcePath: string, targetPath: string): Promise<void>;
  abstract copy(sourcePath: string, targetPath: string): Promise<void>;

  abstract createDirectory(path: string): Promise<void>;
  abstract deleteDirectory(path: string, recursive?: boolean): Promise<void>;

  protected normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  protected joinPath(...parts: string[]): string {
    return this.normalizePath(parts.join('/'));
  }
}
