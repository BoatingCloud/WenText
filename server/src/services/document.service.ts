import { Readable } from 'stream';
import path from 'path';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { RepositoryService } from './repository.service.js';
import { EncryptionUtil } from '../utils/encryption.js';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../config/redis.js';
import type { StorageAdapter } from '../storage-adapters/base.js';
import type { Document, DocumentType, DocStatus, Prisma, Repository } from '@prisma/client';

export interface UploadInput {
  repositoryId: string;
  parentPath: string;
  fileName: string;
  fileData: Buffer | Readable;
  fileSize: number;
  creatorId: string;
  commitMessage?: string;
}

export interface CreateFolderInput {
  repositoryId: string;
  parentPath: string;
  name: string;
  creatorId: string;
}

export interface DocumentQueryOptions {
  page?: number;
  pageSize?: number;
  repositoryId?: string;
  parentId?: string;
  path?: string;
  type?: DocumentType;
  status?: DocStatus;
  search?: string;
  creatorId?: string;
}

export interface MoveInput {
  documentId: string;
  targetPath: string;
  userId: string;
}

export interface CopyInput {
  documentId: string;
  targetPath: string;
  userId: string;
}

export interface UpdateTextContentInput {
  documentId: string;
  content: string;
  userId: string;
  commitMessage?: string;
}

export interface UpdateBinaryContentInput {
  documentId: string;
  fileData: Buffer;
  userId: string;
  commitMessage?: string;
}

export class DocumentService {
  private static readonly CACHE_PREFIX = 'doc:';
  private static readonly CACHE_TTL = 300;

  static async findById(id: string): Promise<Document | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await cacheGet<Document>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
        tags: {
          include: { tag: true },
        },
        locks: true,
      },
    });

    if (doc) {
      await cacheSet(cacheKey, doc, this.CACHE_TTL);
    }
    return doc;
  }

  static async findByPath(repositoryId: string, docPath: string): Promise<Document | null> {
    const prisma = getPrisma();
    return prisma.document.findUnique({
      where: {
        repositoryId_path: { repositoryId, path: docPath },
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
        tags: {
          include: { tag: true },
        },
      },
    });
  }

  static async listDirectory(
    repositoryId: string,
    parentPath: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<{
    documents: Document[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const normalizedPath = this.normalizePath(parentPath);

    let parentId: string | null = null;
    if (normalizedPath !== '/') {
      const parent = await this.findByPath(repositoryId, normalizedPath);
      if (!parent) {
        throw new NotFoundError('目录');
      }
      parentId = parent.id;
    }

    const where: Prisma.DocumentWhereInput = {
      repositoryId,
      parentId,
      status: 'NORMAL',
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          creator: {
            select: { id: true, name: true, username: true },
          },
          _count: {
            select: { versions: true },
          },
        },
        orderBy: [
          { type: 'asc' },
          { name: 'asc' },
        ],
      }),
      prisma.document.count({ where }),
    ]);

    return { documents, total, page, pageSize };
  }

  static async upload(input: UploadInput): Promise<Document> {
    const prisma = getPrisma();

    const repo = await RepositoryService.findById(input.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    const normalizedParentPath = this.normalizePath(input.parentPath);
    const fileName = this.sanitizeFileName(input.fileName);
    const filePath = this.joinPath(normalizedParentPath, fileName);

    const existing = await this.findByPath(input.repositoryId, filePath);
    if (existing) {
      return this.updateFile(existing, input, repo);
    }

    let parentId: string | null = null;
    if (normalizedParentPath !== '/') {
      const parent = await this.findByPath(input.repositoryId, normalizedParentPath);
      if (!parent || parent.type !== 'FOLDER') {
        throw new NotFoundError('父目录');
      }
      parentId = parent.id;
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = mime.lookup(fileName) || 'application/octet-stream';

    let fileData = Buffer.isBuffer(input.fileData)
      ? input.fileData
      : await this.streamToBuffer(input.fileData);

    const md5 = EncryptionUtil.hashMD5(fileData);

    if (repo.encryptEnabled) {
      const { encrypted, iv, authTag } = EncryptionUtil.encryptFile(fileData);
      fileData = encrypted;
    }

    const storagePath = this.generateStoragePath(repo.id, filePath);
    await adapter.write(storagePath, fileData, { overwrite: true });

    const document = await prisma.document.create({
      data: {
        repositoryId: input.repositoryId,
        parentId,
        name: fileName,
        path: filePath,
        type: 'FILE',
        mimeType,
        size: BigInt(input.fileSize),
        md5,
        extension: ext,
        isEncrypted: repo.encryptEnabled,
        creatorId: input.creatorId,
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (repo.versionEnabled) {
      await this.appendVersionSnapshot({
        documentId: document.id,
        repo,
        adapter,
        currentStoragePath: storagePath,
        size: BigInt(input.fileSize),
        md5,
        commitMessage: input.commitMessage || '初始版本',
        creatorId: input.creatorId,
        extension: document.extension,
      });
    }

    await RepositoryService.updateStats(input.repositoryId);

    return document;
  }

  private static async updateFile(
    existing: Document,
    input: UploadInput,
    repo: Repository
  ): Promise<Document> {
    const prisma = getPrisma();
    const adapter = await RepositoryService.getStorageAdapter(repo);

    let fileData = Buffer.isBuffer(input.fileData)
      ? input.fileData
      : await this.streamToBuffer(input.fileData);

    const md5 = EncryptionUtil.hashMD5(fileData);

    if (md5 === existing.md5) {
      return existing;
    }

    if (repo.encryptEnabled) {
      const { encrypted } = EncryptionUtil.encryptFile(fileData);
      fileData = encrypted;
    }

    const storagePath = this.generateStoragePath(repo.id, existing.path);
    await adapter.write(storagePath, fileData, { overwrite: true });

    const document = await prisma.document.update({
      where: { id: existing.id },
      data: {
        size: BigInt(input.fileSize),
        md5,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (repo.versionEnabled) {
      await this.appendVersionSnapshot({
        documentId: existing.id,
        repo,
        adapter,
        currentStoragePath: storagePath,
        size: BigInt(input.fileSize),
        md5,
        commitMessage: input.commitMessage,
        creatorId: input.creatorId,
        extension: document.extension,
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${existing.id}`);
    await RepositoryService.updateStats(input.repositoryId);

    return document;
  }

  static async createFolder(input: CreateFolderInput): Promise<Document> {
    const prisma = getPrisma();

    const repo = await RepositoryService.findById(input.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    const normalizedParentPath = this.normalizePath(input.parentPath);
    const folderName = this.sanitizeFileName(input.name);
    const folderPath = this.joinPath(normalizedParentPath, folderName);

    const existing = await this.findByPath(input.repositoryId, folderPath);
    if (existing) {
      throw new ConflictError('目录已存在');
    }

    let parentId: string | null = null;
    if (normalizedParentPath !== '/') {
      const parent = await this.findByPath(input.repositoryId, normalizedParentPath);
      if (!parent || parent.type !== 'FOLDER') {
        throw new NotFoundError('父目录');
      }
      parentId = parent.id;
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    await adapter.createDirectory(this.generateStoragePath(repo.id, folderPath));

    const folder = await prisma.document.create({
      data: {
        repositoryId: input.repositoryId,
        parentId,
        name: folderName,
        path: folderPath,
        type: 'FOLDER',
        creatorId: input.creatorId,
      },
    });

    return folder;
  }

  static async download(documentId: string): Promise<{ stream: Readable; document: Document }> {
    const document = await this.findById(documentId);
    if (!document || document.type !== 'FILE') {
      throw new NotFoundError('文件');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const storagePath = this.generateStoragePath(repo.id, document.path);
    const stream = await adapter.readStream(storagePath);

    return { stream, document };
  }

  static async getTextContent(documentId: string): Promise<{
    documentId: string;
    name: string;
    content: string;
    editable: boolean;
  }> {
    const document = await this.findById(documentId);
    if (!document || document.type !== 'FILE') {
      throw new NotFoundError('文件');
    }

    if (!this.isTextDocument(document)) {
      throw new ValidationError('该文件类型暂不支持在线查看或编辑');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    if (repo.encryptEnabled || document.isEncrypted) {
      throw new ValidationError('加密文件暂不支持在线编辑');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const storagePath = this.generateStoragePath(repo.id, document.path);
    const buffer = await this.readFileOrThrowNotFound(adapter, storagePath);

    const content = buffer.toString('utf8').replace(/^\uFEFF/, '');

    return {
      documentId: document.id,
      name: document.name,
      content,
      editable: true,
    };
  }

  static async updateTextContent(input: UpdateTextContentInput): Promise<Document> {
    const prisma = getPrisma();

    const document = await this.findById(input.documentId);
    if (!document || document.type !== 'FILE') {
      throw new NotFoundError('文件');
    }

    if (!this.isTextDocument(document)) {
      throw new ValidationError('该文件类型暂不支持在线编辑');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    if (repo.encryptEnabled || document.isEncrypted) {
      throw new ValidationError('加密文件暂不支持在线编辑');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const storagePath = this.generateStoragePath(repo.id, document.path);
    const contentBuffer = Buffer.from(input.content, 'utf8');
    const md5 = EncryptionUtil.hashMD5(contentBuffer);

    if (md5 === document.md5) {
      return document;
    }

    await adapter.write(storagePath, contentBuffer, { overwrite: true });

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        size: BigInt(contentBuffer.length),
        md5,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (repo.versionEnabled) {
      await this.appendVersionSnapshot({
        documentId: document.id,
        repo,
        adapter,
        currentStoragePath: storagePath,
        size: BigInt(contentBuffer.length),
        md5,
        commitMessage: input.commitMessage,
        creatorId: input.userId,
        extension: updated.extension,
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${document.id}`);
    await RepositoryService.updateStats(document.repositoryId);

    return updated;
  }

  static async getOnlyOfficeDocument(documentId: string): Promise<{
    document: Document;
    fileType: string;
    documentType: 'word' | 'cell' | 'slide';
  }> {
    const document = await this.findById(documentId);
    if (!document || document.type !== 'FILE') {
      throw new NotFoundError('文件');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    if (repo.encryptEnabled || document.isEncrypted) {
      throw new ValidationError('加密文件暂不支持 OnlyOffice 在线编辑');
    }

    const fileType = (document.extension || '').replace('.', '').toLowerCase();
    const wordTypes = new Set(['doc', 'docx', 'odt', 'rtf', 'txt', 'md']);
    const cellTypes = new Set(['xls', 'xlsx', 'ods', 'csv']);
    const slideTypes = new Set(['ppt', 'pptx', 'odp']);

    let documentType: 'word' | 'cell' | 'slide' | null = null;
    if (wordTypes.has(fileType)) documentType = 'word';
    if (cellTypes.has(fileType)) documentType = 'cell';
    if (slideTypes.has(fileType)) documentType = 'slide';

    if (!documentType) {
      throw new ValidationError('该文件类型暂不支持 OnlyOffice 在线编辑');
    }

    return {
      document,
      fileType,
      documentType,
    };
  }

  static async getFileBuffer(documentId: string): Promise<{ document: Document; buffer: Buffer }> {
    const document = await this.findById(documentId);
    if (!document || document.type !== 'FILE') {
      throw new NotFoundError('文件');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const storagePath = this.generateStoragePath(repo.id, document.path);
    const buffer = await this.readFileOrThrowNotFound(adapter, storagePath);

    return { document, buffer };
  }

  static async updateBinaryContent(input: UpdateBinaryContentInput): Promise<Document> {
    const prisma = getPrisma();

    const document = await this.findById(input.documentId);
    if (!document || document.type !== 'FILE') {
      throw new NotFoundError('文件');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    if (repo.encryptEnabled || document.isEncrypted) {
      throw new ValidationError('加密文件暂不支持在线编辑');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const storagePath = this.generateStoragePath(repo.id, document.path);
    const md5 = EncryptionUtil.hashMD5(input.fileData);

    if (md5 === document.md5) {
      return document;
    }

    await adapter.write(storagePath, input.fileData, { overwrite: true });

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        size: BigInt(input.fileData.length),
        md5,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (repo.versionEnabled) {
      await this.appendVersionSnapshot({
        documentId: document.id,
        repo,
        adapter,
        currentStoragePath: storagePath,
        size: BigInt(input.fileData.length),
        md5,
        commitMessage: input.commitMessage,
        creatorId: input.userId,
        extension: updated.extension,
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${document.id}`);
    await RepositoryService.updateStats(document.repositoryId);

    return updated;
  }

  static async delete(documentId: string, permanent = false): Promise<void> {
    const prisma = getPrisma();

    const document = await this.findById(documentId);
    if (!document) {
      throw new NotFoundError('文档');
    }

    if (permanent) {
      const repo = await RepositoryService.findById(document.repositoryId);
      if (repo) {
        const adapter = await RepositoryService.getStorageAdapter(repo);
        const storagePath = this.generateStoragePath(repo.id, document.path);

        if (document.type === 'FOLDER') {
          await adapter.deleteDirectory(storagePath, true);
          await prisma.document.deleteMany({
            where: { path: { startsWith: document.path + '/' } },
          });
        } else {
          await adapter.delete(storagePath);
        }
      }

      await prisma.document.delete({ where: { id: documentId } });
    } else {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${documentId}`);
    await RepositoryService.updateStats(document.repositoryId);
  }

  static async move(input: MoveInput): Promise<Document> {
    const prisma = getPrisma();

    const document = await this.findById(input.documentId);
    if (!document) {
      throw new NotFoundError('文档');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    const targetPath = this.normalizePath(input.targetPath);
    const newPath = this.joinPath(targetPath, document.name);

    const existing = await this.findByPath(document.repositoryId, newPath);
    if (existing) {
      throw new ConflictError('目标位置已存在同名文件');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const oldStoragePath = this.generateStoragePath(repo.id, document.path);
    const newStoragePath = this.generateStoragePath(repo.id, newPath);

    await adapter.move(oldStoragePath, newStoragePath);

    let newParentId: string | null = null;
    if (targetPath !== '/') {
      const parent = await this.findByPath(document.repositoryId, targetPath);
      if (!parent || parent.type !== 'FOLDER') {
        throw new NotFoundError('目标目录');
      }
      newParentId = parent.id;
    }

    const updated = await prisma.document.update({
      where: { id: input.documentId },
      data: {
        path: newPath,
        parentId: newParentId,
      },
    });

    if (document.type === 'FOLDER') {
      const children = await prisma.document.findMany({
        where: { path: { startsWith: document.path + '/' } },
      });

      for (const child of children) {
        const childNewPath = child.path.replace(document.path, newPath);
        await prisma.document.update({
          where: { id: child.id },
          data: { path: childNewPath },
        });
      }
    }

    await cacheDel(`${this.CACHE_PREFIX}${input.documentId}`);
    return updated;
  }

  static async rename(documentId: string, newName: string): Promise<Document> {
    const prisma = getPrisma();

    const document = await this.findById(documentId);
    if (!document) {
      throw new NotFoundError('文档');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    const sanitizedName = this.sanitizeFileName(newName);
    const parentPath = path.dirname(document.path);
    const newPath = this.joinPath(parentPath, sanitizedName);

    const existing = await this.findByPath(document.repositoryId, newPath);
    if (existing && existing.id !== documentId) {
      throw new ConflictError('同名文件已存在');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const oldStoragePath = this.generateStoragePath(repo.id, document.path);
    const newStoragePath = this.generateStoragePath(repo.id, newPath);

    await adapter.move(oldStoragePath, newStoragePath);

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        name: sanitizedName,
        path: newPath,
        extension: document.type === 'FILE' ? path.extname(sanitizedName).toLowerCase() : null,
      },
    });

    await cacheDel(`${this.CACHE_PREFIX}${documentId}`);
    return updated;
  }

  static async getVersions(documentId: string): Promise<{
    versions: Array<{
      id: string;
      version: number;
      size: bigint;
      md5: string;
      commitMessage: string | null;
      creatorId: string;
      createdAt: Date;
    }>;
  }> {
    const prisma = getPrisma();

    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
    });

    return { versions };
  }

  static async restoreVersion(documentId: string, versionId: string, userId: string): Promise<Document> {
    const prisma = getPrisma();

    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.documentId !== documentId) {
      throw new NotFoundError('版本');
    }

    const document = await this.findById(documentId);
    if (!document) {
      throw new NotFoundError('文档');
    }

    const repo = await RepositoryService.findById(document.repositoryId);
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    const adapter = await RepositoryService.getStorageAdapter(repo);
    const currentStoragePath = this.generateStoragePath(repo.id, document.path);
    const versionData = await this.readFileOrThrowNotFound(adapter, version.storagePath);

    await adapter.write(currentStoragePath, versionData, { overwrite: true });

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        size: version.size,
        md5: version.md5,
      },
    });

    if (repo.versionEnabled) {
      await this.appendVersionSnapshot({
        documentId: document.id,
        repo,
        adapter,
        currentStoragePath,
        size: version.size,
        md5: version.md5,
        commitMessage: `恢复到版本 ${version.version}`,
        creatorId: userId,
        extension: updated.extension,
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${documentId}`);
    await RepositoryService.updateStats(document.repositoryId);
    return updated;
  }

  private static async appendVersionSnapshot(input: {
    documentId: string;
    repo: Repository;
    adapter: StorageAdapter;
    currentStoragePath: string;
    size: bigint;
    md5: string;
    commitMessage?: string;
    creatorId: string;
    extension?: string | null;
  }): Promise<void> {
    const prisma = getPrisma();
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId: input.documentId },
      orderBy: { version: 'desc' },
    });
    const newVersion = (lastVersion?.version || 0) + 1;

    const snapshotPath = this.generateVersionStoragePath(
      input.repo.id,
      input.documentId,
      newVersion,
      input.extension
    );

    await input.adapter.copy(input.currentStoragePath, snapshotPath);

    await prisma.documentVersion.create({
      data: {
        documentId: input.documentId,
        version: newVersion,
        size: input.size,
        md5: input.md5,
        storagePath: snapshotPath,
        commitMessage: input.commitMessage || `版本 ${newVersion}`,
        creatorId: input.creatorId,
      },
    });

    await this.trimVersions(input.documentId, input.repo, input.adapter);
  }

  private static async trimVersions(
    documentId: string,
    repo: Repository,
    adapter: StorageAdapter
  ): Promise<void> {
    if (repo.maxVersions <= 0) {
      return;
    }

    const prisma = getPrisma();
    const versionsToDelete = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      skip: repo.maxVersions,
    });

    if (versionsToDelete.length === 0) {
      return;
    }

    await prisma.documentVersion.deleteMany({
      where: { id: { in: versionsToDelete.map((v) => v.id) } },
    });

    for (const version of versionsToDelete) {
      if (!this.isManagedVersionSnapshotPath(repo.id, version.storagePath)) {
        continue;
      }
      try {
        await adapter.delete(version.storagePath);
      } catch {
        // Ignore stale snapshot cleanup failures.
      }
    }
  }

  private static isManagedVersionSnapshotPath(repoId: string, storagePath: string): boolean {
    const versionRoot = this.joinPath(repoId, '.versions') + '/';
    return storagePath.startsWith(versionRoot);
  }

  private static generateVersionStoragePath(
    repoId: string,
    documentId: string,
    version: number,
    extension?: string | null
  ): string {
    const normalizedExt = extension
      ? (extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`)
      : '';
    return this.joinPath(repoId, '.versions', documentId, `v${version}${normalizedExt}`);
  }

  private static normalizePath(p: string): string {
    let normalized = p.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private static joinPath(...parts: string[]): string {
    return this.normalizePath(parts.join('/'));
  }

  private static sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .trim()
      .slice(0, 255);
  }

  private static isTextDocument(document: Document): boolean {
    const ext = (document.extension || '').toLowerCase();
    const textExts = new Set([
      '.txt',
      '.md',
      '.markdown',
      '.json',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.css',
      '.scss',
      '.html',
      '.htm',
      '.xml',
      '.yaml',
      '.yml',
      '.ini',
      '.conf',
      '.csv',
      '.log',
      '.sql',
      '.sh',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.vue',
    ]);

    return (document.mimeType?.startsWith('text/') ?? false) || textExts.has(ext);
  }

  private static generateStoragePath(repoId: string, docPath: string): string {
    return this.joinPath(repoId, docPath);
  }

  private static async readFileOrThrowNotFound(
    adapter: StorageAdapter,
    storagePath: string
  ): Promise<Buffer> {
    try {
      return await adapter.read(storagePath);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        throw new NotFoundError('文件内容');
      }
      throw error;
    }
  }

  private static isMissingFileError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && (
        ('code' in error && ((error as { code?: string }).code === 'ENOENT' || (error as { code?: string }).code === 'NotFound'))
        || ('message' in error && String((error as { message?: unknown }).message).includes('no such file'))
      );
  }

  private static async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
