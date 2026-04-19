import { getPrisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { LocalStorageAdapter } from '../storage-adapters/local.js';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';

const ATTACHMENT_BASE_DIR = process.env.ARCHIVE_ATTACHMENT_PATH || './data/archive-attachments';

function getStorage() {
  return new LocalStorageAdapter({ type: 'local', basePath: ATTACHMENT_BASE_DIR });
}

export class ArchiveAttachmentService {
  static async upload(
    archiveId: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string },
    uploaderId: string,
  ) {
    const prisma = getPrisma();

    const archive = await prisma.physicalArchive.findUnique({
      where: { id: archiveId },
      select: { id: true },
    });
    if (!archive) throw new NotFoundError('实体档案');

    const ext = path.extname(file.originalname).toLowerCase();
    const md5 = crypto.createHash('md5').update(file.buffer).digest('hex');
    const storageName = `${crypto.randomUUID()}${ext}`;
    const storagePath = `${archiveId}/${storageName}`;

    const storage = getStorage();
    await storage.connect();
    await storage.write(storagePath, file.buffer, { overwrite: true });

    const mimeType = file.mimetype || mime.lookup(file.originalname) || null;

    const attachment = await prisma.physicalArchiveAttachment.create({
      data: {
        archiveId,
        fileName: file.originalname,
        fileExtension: ext || null,
        fileSize: BigInt(file.buffer.length),
        mimeType,
        storagePath,
        md5,
        uploaderId,
      },
      include: {
        uploader: { select: { id: true, name: true, username: true } },
      },
    });

    return serializeAttachment(attachment);
  }

  static async uploadMultiple(
    archiveId: string,
    files: Array<{ originalname: string; buffer: Buffer; mimetype?: string }>,
    uploaderId: string,
  ) {
    const results = [];
    for (const file of files) {
      const result = await this.upload(archiveId, file, uploaderId);
      results.push(result);
    }
    return results;
  }

  static async list(archiveId: string) {
    const prisma = getPrisma();

    const archive = await prisma.physicalArchive.findUnique({
      where: { id: archiveId },
      select: { id: true },
    });
    if (!archive) throw new NotFoundError('实体档案');

    const attachments = await prisma.physicalArchiveAttachment.findMany({
      where: { archiveId },
      include: {
        uploader: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return attachments.map(serializeAttachment);
  }

  static async delete(attachmentId: string) {
    const prisma = getPrisma();

    const attachment = await prisma.physicalArchiveAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundError('附件');

    // Delete from storage
    try {
      const storage = getStorage();
      await storage.connect();
      await storage.delete(attachment.storagePath);
    } catch {
      // File may not exist on disk, continue with DB deletion
    }

    await prisma.physicalArchiveAttachment.delete({
      where: { id: attachmentId },
    });
  }

  static async getDownloadInfo(attachmentId: string) {
    const prisma = getPrisma();

    const attachment = await prisma.physicalArchiveAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundError('附件');

    const storage = getStorage();
    await storage.connect();
    const stream = await storage.readStream(attachment.storagePath);

    return {
      stream,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType || 'application/octet-stream',
      fileSize: Number(attachment.fileSize),
    };
  }
}

function serializeAttachment(attachment: any) {
  return {
    ...attachment,
    fileSize: attachment.fileSize != null ? attachment.fileSize.toString() : '0',
  };
}
