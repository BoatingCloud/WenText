import { Router, type Request } from 'express';
import multer from 'multer';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { config, getOnlyOfficeUrl, getOnlyOfficeServiceUrl, getOnlyOfficeInternalServerUrl } from '../config/index.js';
import { DocumentService } from '../services/document.service.js';
import { SearchService } from '../services/search.service.js';
import { RepositoryService } from '../services/repository.service.js';
import { SystemConfigService } from '../services/system-config.service.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import {
  createFolderSchema,
  moveDocumentSchema,
  renameDocumentSchema,
  idParamSchema,
} from './schemas.js';

const router = Router();

const decodeUploadFileName = (fileName: string): string => {
  try {
    const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
    const roundTrip = Buffer.from(decoded, 'utf8').toString('latin1');
    if (roundTrip === fileName && decoded.trim().length > 0) {
      return decoded;
    }
  } catch {
    // ignore and fallback to original name
  }
  return fileName;
};

const withUploadLimit = (mode: 'single' | 'multiple') => {
  return asyncHandler(async (req, _res, next) => {
    const limitBytes = await SystemConfigService.getUploadLimitBytes();
    const uploader = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: limitBytes,
      },
    });

    const uploadHandler =
      mode === 'single'
        ? uploader.single('file')
        : uploader.array('files', 20);

    uploadHandler(req, _res, (error) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        const limitMB = Math.max(1, Math.round(limitBytes / 1024 / 1024));
        return next(new ValidationError(`上传失败：单文件大小不能超过 ${limitMB}MB`));
      }
      return next(error || undefined);
    });
  });
};

interface OnlyOfficeAccessTokenPayload extends JwtPayload {
  documentId: string;
  userId: string;
  canEdit: boolean;
}

const getOnlyOfficeSecret = (): string =>
  config.ONLYOFFICE_JWT_SECRET || process.env.ONLYOFFICE_JWT_SECRET || 'viewmatrix';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const rewriteOnlyOfficeFileUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      const serviceBase = new URL(getOnlyOfficeServiceUrl());
      parsed.protocol = serviceBase.protocol;
      parsed.hostname = serviceBase.hostname;
      parsed.port = serviceBase.port;
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const resolveOnlyOfficeToken = (req: Request): string => {
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = queryToken || bearerToken;
  if (!token) {
    throw new AuthenticationError('OnlyOffice 访问令牌缺失');
  }
  return token;
};

const verifyOnlyOfficeToken = (req: Request, documentId: string): OnlyOfficeAccessTokenPayload => {
  const token = resolveOnlyOfficeToken(req);
  const decoded = jwt.verify(token, getOnlyOfficeSecret()) as OnlyOfficeAccessTokenPayload;
  if (decoded.documentId !== documentId) {
    throw new AuthenticationError('OnlyOffice 访问令牌无效');
  }
  return decoded;
};

const onlyOfficeCallbackSchema = z.object({
  status: z.coerce.number().int(),
  url: z.string().optional(),
}).passthrough();

router.get(
  '/:id/onlyoffice/file',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    verifyOnlyOfficeToken(req, req.params.id);
    const { document, buffer } = await DocumentService.getFileBuffer(req.params.id);

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    const encodedName = encodeURIComponent(document.name);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');

    res.status(200).send(buffer);
  })
);

router.post(
  '/:id/onlyoffice/callback',
  validate(idParamSchema, 'params'),
  async (req, res) => {
    try {
      const tokenPayload = verifyOnlyOfficeToken(req, req.params.id);
      const parsed = onlyOfficeCallbackSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('OnlyOffice 回调参数格式错误');
      }

      const callback = parsed.data;
      const callbackUrl = (callback.url || '').trim();
      const shouldSave = [2, 6].includes(callback.status) && callbackUrl.length > 0;

      if (!shouldSave) {
        return res.status(200).json({ error: 0 });
      }

      if (!tokenPayload.canEdit) {
        throw new AuthenticationError('只读模式不可保存');
      }

      const downloadCandidates = [rewriteOnlyOfficeFileUrl(callbackUrl), callbackUrl]
        .filter((url, index, arr) => arr.indexOf(url) === index);

      let response: Response | null = null;
      let lastError: unknown = null;

      for (const candidate of downloadCandidates) {
        try {
          response = await fetch(candidate);
          if (response.ok) {
            break;
          }
          lastError = new ValidationError(`OnlyOffice 文件下载失败: ${response.status}`);
        } catch (error) {
          lastError = error;
        }
      }

      if (!response || !response.ok) {
        throw new ValidationError(
          `OnlyOffice 文件下载失败: ${lastError instanceof Error ? lastError.message : String(lastError)}`
        );
      }

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      await DocumentService.updateBinaryContent({
        documentId: req.params.id,
        fileData: fileBuffer,
        userId: tokenPayload.userId,
        commitMessage: callback.status === 6 ? 'OnlyOffice 强制保存' : 'OnlyOffice 在线编辑保存',
      });

      try {
        const updatedDocument = await DocumentService.findById(req.params.id);
        if (updatedDocument) {
          const content = await SearchService.extractContent(updatedDocument, fileBuffer);
          await SearchService.indexDocument(updatedDocument, content);
        }
      } catch (error) {
        logger.warn('Document indexed failed after onlyoffice save, skip indexing', {
          documentId: req.params.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return res.status(200).json({ error: 0 });
    } catch (error) {
      logger.error('OnlyOffice callback failed', {
        documentId: req.params.id,
        callbackStatus: req.body?.status,
        callbackUrl: req.body?.url,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(200).json({ error: 1 });
    }
  }
);

router.use(authenticate);

router.get(
  '/repo/:repoId',
  requirePermission('doc:view'),
  asyncHandler(async (req, res) => {
    const { repoId } = req.params;
    const { path = '/', page = '1', pageSize = '50' } = req.query;

    const result = await DocumentService.listDirectory(
      repoId,
      path as string,
      { page: parseInt(page as string), pageSize: parseInt(pageSize as string) }
    );

    return paginatedResponse(res, result.documents, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

router.get(
  '/:id',
  requirePermission('doc:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const document = await DocumentService.findById(req.params.id);
    return successResponse(res, document);
  })
);

router.post(
  '/repo/:repoId/upload',
  requirePermission('doc:upload'),
  withUploadLimit('single'),
  asyncHandler(async (req, res) => {
    const { repoId } = req.params;
    const { parentPath = '/', commitMessage } = req.body;
    const file = req.file!;

    const document = await DocumentService.upload({
      repositoryId: repoId,
      parentPath,
      fileName: decodeUploadFileName(file.originalname),
      fileData: file.buffer,
      fileSize: file.size,
      creatorId: req.user!.id,
      commitMessage,
    });

    const repo = await RepositoryService.findById(repoId);
    if (repo) {
      try {
        await RepositoryService.getStorageAdapter(repo);
        const content = await SearchService.extractContent(document, file.buffer);
        await SearchService.indexDocument(document, content);
      } catch (error) {
        logger.warn('Document indexed failed after upload, skip indexing', {
          documentId: document.id,
          repositoryId: repoId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return successResponse(res, document, '文件上传成功', 201);
  })
);

router.post(
  '/repo/:repoId/upload-multiple',
  requirePermission('doc:upload'),
  withUploadLimit('multiple'),
  asyncHandler(async (req, res) => {
    const { repoId } = req.params;
    const { parentPath = '/' } = req.body;
    const files = req.files as Express.Multer.File[];
    const repo = await RepositoryService.findById(repoId);

    const documents = [];
    for (const file of files) {
      const document = await DocumentService.upload({
        repositoryId: repoId,
        parentPath,
        fileName: decodeUploadFileName(file.originalname),
        fileData: file.buffer,
        fileSize: file.size,
        creatorId: req.user!.id,
      });
      documents.push(document);

      if (repo) {
        try {
          await RepositoryService.getStorageAdapter(repo);
          const content = await SearchService.extractContent(document, file.buffer);
          await SearchService.indexDocument(document, content);
        } catch (error) {
          logger.warn('Document indexed failed after batch upload, skip indexing', {
            documentId: document.id,
            repositoryId: repoId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return successResponse(res, documents, '文件上传成功', 201);
  })
);

router.post(
  '/repo/:repoId/folder',
  requirePermission('doc:upload'),
  validate(createFolderSchema),
  asyncHandler(async (req, res) => {
    const { repoId } = req.params;

    const folder = await DocumentService.createFolder({
      repositoryId: repoId,
      parentPath: req.body.parentPath,
      name: req.body.name,
      creatorId: req.user!.id,
    });

    return successResponse(res, folder, '文件夹创建成功', 201);
  })
);

router.get(
  '/:id/content',
  requirePermission('doc:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const result = await DocumentService.getTextContent(req.params.id);
    return successResponse(res, result);
  })
);

router.get(
  '/:id/onlyoffice/config',
  requirePermission('doc:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (!config.ONLYOFFICE_ENABLED) {
      throw new ValidationError('系统未启用 OnlyOffice 集成');
    }

    const canEdit = req.user!.permissions.includes('doc:edit');
    const { document, fileType, documentType } = await DocumentService.getOnlyOfficeDocument(req.params.id);
    const secret = getOnlyOfficeSecret();

    const serverBaseUrl = trimTrailingSlash(getOnlyOfficeInternalServerUrl(req));
    const onlyOfficeBaseUrl = trimTrailingSlash(getOnlyOfficeUrl());

    // 生成用于文件下载和回调的访问令牌
    const accessToken = jwt.sign(
      {
        documentId: document.id,
        userId: req.user!.id,
        canEdit,
      },
      secret,
      { expiresIn: '6h' }
    );

    const documentKey = `${document.id}-${new Date(document.updatedAt).getTime()}`.slice(0, 128);

    // 构建 OnlyOffice 配置对象（不下发 browser JWT，避免与容器 JWT 策略冲突）
    const editorConfig = {
      type: 'desktop',
      documentType,
      document: {
        fileType,
        key: documentKey,
        title: document.name,
        url: `${serverBaseUrl}/api/documents/${document.id}/onlyoffice/file?token=${encodeURIComponent(accessToken)}`,
        permissions: {
          edit: canEdit,
          review: canEdit,
          comment: true,
          download: true,
          print: true,
        },
      },
      editorConfig: {
        mode: canEdit ? 'edit' : 'view',
        callbackUrl: `${serverBaseUrl}/api/documents/${document.id}/onlyoffice/callback?token=${encodeURIComponent(accessToken)}`,
        lang: 'zh-CN',
        user: {
          id: req.user!.id,
          name: req.user!.name || req.user!.username,
        },
        customization: {
          autosave: true,
          forcesave: true,
          compactHeader: true,
        },
      },
    };

    return successResponse(res, {
      documentId: document.id,
      name: document.name,
      scriptUrl: `${onlyOfficeBaseUrl}/web-apps/apps/api/documents/api.js`,
      config: editorConfig,
    });
  })
);

router.put(
  '/:id/content',
  requirePermission('doc:edit'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({
      content: z.string(),
      commitMessage: z.string().max(200).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const document = await DocumentService.updateTextContent({
      documentId: req.params.id,
      content: req.body.content,
      userId: req.user!.id,
      commitMessage: req.body.commitMessage,
    });

    try {
      await SearchService.indexDocument(document, req.body.content);
    } catch (error) {
      logger.warn('Document indexed failed after online edit, skip indexing', {
        documentId: document.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return successResponse(res, document, '文档内容保存成功');
  })
);

router.get(
  '/:id/preview',
  requirePermission('doc:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { document, buffer } = await DocumentService.getFileBuffer(req.params.id);

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    const encodedName = encodeURIComponent(document.name);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodedName}`
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.status(200).send(buffer);
  })
);

router.get(
  '/:id/download',
  requirePermission('doc:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { document, buffer } = await DocumentService.getFileBuffer(req.params.id);

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    const encodedName = encodeURIComponent(document.name);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedName}`
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.status(200).send(buffer);
  })
);

router.post(
  '/:id/move',
  requirePermission('doc:edit'),
  validateMultiple({
    params: idParamSchema,
    body: moveDocumentSchema,
  }),
  asyncHandler(async (req, res) => {
    const document = await DocumentService.move({
      documentId: req.params.id,
      targetPath: req.body.targetPath,
      userId: req.user!.id,
    });
    return successResponse(res, document, '移动成功');
  })
);

router.post(
  '/:id/rename',
  requirePermission('doc:edit'),
  validateMultiple({
    params: idParamSchema,
    body: renameDocumentSchema,
  }),
  asyncHandler(async (req, res) => {
    const document = await DocumentService.rename(req.params.id, req.body.name);
    return successResponse(res, document, '重命名成功');
  })
);

router.delete(
  '/:id',
  requirePermission('doc:delete'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const permanent = req.query.permanent === 'true';
    await DocumentService.delete(req.params.id, permanent);
    await SearchService.removeDocument(req.params.id);
    return successResponse(res, null, '删除成功');
  })
);

router.get(
  '/:id/versions',
  requirePermission('doc:version'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const result = await DocumentService.getVersions(req.params.id);
    return successResponse(res, result.versions);
  })
);

router.post(
  '/:id/versions/:versionId/restore',
  requirePermission('doc:version'),
  asyncHandler(async (req, res) => {
    const document = await DocumentService.restoreVersion(
      req.params.id,
      req.params.versionId,
      req.user!.id
    );
    return successResponse(res, document, '版本恢复成功');
  })
);

export default router;
