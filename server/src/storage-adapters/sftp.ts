import SftpClient from 'ssh2-sftp-client';
import { Readable } from 'stream';
import { StorageAdapter, StorageFile, StorageConfig, WriteOptions, ReadOptions } from './base.js';
import { StorageError } from '../utils/errors.js';

export interface SftpStorageConfig extends StorageConfig {
  type: 'sftp';
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  basePath: string;
}

export class SftpStorageAdapter extends StorageAdapter {
  private client: SftpClient;
  private connected: boolean = false;
  private sftpConfig: SftpStorageConfig;

  constructor(config: SftpStorageConfig) {
    super(config);
    this.sftpConfig = config;
    this.client = new SftpClient();
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    await this.client.connect({
      host: this.sftpConfig.host,
      port: this.sftpConfig.port,
      username: this.sftpConfig.username,
      password: this.sftpConfig.password,
      privateKey: this.sftpConfig.privateKey,
      passphrase: this.sftpConfig.passphrase,
    });

    this.connected = true;

    const exists = await this.client.exists(this.sftpConfig.basePath);
    if (!exists) {
      await this.client.mkdir(this.sftpConfig.basePath, true);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }

  private getFullPath(relativePath: string): string {
    return this.joinPath(this.sftpConfig.basePath, this.normalizePath(relativePath));
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.exists(this.getFullPath(path));
    return result !== false;
  }

  async stat(path: string): Promise<StorageFile> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(path);
    const stats = await this.client.stat(fullPath);
    const name = path.split('/').pop() || path;

    return {
      name,
      path,
      size: stats.size,
      isDirectory: stats.isDirectory,
      modifiedAt: new Date(stats.modifyTime),
      createdAt: new Date(stats.accessTime),
    };
  }

  async list(dirPath: string): Promise<StorageFile[]> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(dirPath);
    const entries = await this.client.list(fullPath);

    return entries.map((entry) => ({
      name: entry.name,
      path: this.joinPath(dirPath, entry.name),
      size: entry.size,
      isDirectory: entry.type === 'd',
      modifiedAt: new Date(entry.modifyTime),
      createdAt: new Date(entry.accessTime),
    }));
  }

  async read(path: string, _options?: ReadOptions): Promise<Buffer> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(path);
    return this.client.get(fullPath) as Promise<Buffer>;
  }

  async readStream(path: string, options?: ReadOptions): Promise<Readable> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(path);
    const buffer = await this.client.get(fullPath) as Buffer;

    if (options?.range) {
      return Readable.from(buffer.subarray(options.range.start, options.range.end + 1));
    }

    return Readable.from(buffer);
  }

  async write(path: string, data: Buffer | Readable, options?: WriteOptions): Promise<void> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(path);

    if (!options?.overwrite) {
      const exists = await this.exists(path);
      if (exists) {
        throw new StorageError('File already exists');
      }
    }

    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const dirExists = await this.client.exists(dir);
    if (!dirExists) {
      await this.client.mkdir(dir, true);
    }

    await this.client.put(data, fullPath);
  }

  async delete(path: string): Promise<void> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(path);
    await this.client.delete(fullPath);
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    await this.ensureConnected();
    const sourceFullPath = this.getFullPath(sourcePath);
    const targetFullPath = this.getFullPath(targetPath);

    const targetDir = targetFullPath.substring(0, targetFullPath.lastIndexOf('/'));
    const dirExists = await this.client.exists(targetDir);
    if (!dirExists) {
      await this.client.mkdir(targetDir, true);
    }

    await this.client.rename(sourceFullPath, targetFullPath);
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    const data = await this.read(sourcePath);
    await this.write(targetPath, data, { overwrite: true });
  }

  async createDirectory(dirPath: string): Promise<void> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(dirPath);
    await this.client.mkdir(fullPath, true);
  }

  async deleteDirectory(dirPath: string, recursive = false): Promise<void> {
    await this.ensureConnected();
    const fullPath = this.getFullPath(dirPath);
    await this.client.rmdir(fullPath, recursive);
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
}
