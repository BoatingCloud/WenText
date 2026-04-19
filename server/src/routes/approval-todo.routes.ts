import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import { ApprovalTodoService } from '../services/approval-todo.service.js';
import { idParamSchema, paginationSchema } from './schemas.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

router.use(authenticate);

// 配置签名上传
const signatureStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'signatures');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `signature_${req.user!.id}_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const signatureUpload = multer({
  storage: signatureStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError('只支持PNG和JPG格式的图片'));
    }
  },
});

// 我的待办列表
router.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await ApprovalTodoService.getMyTodos(req.user!.id, { unreadOnly, page, pageSize });
    return paginatedResponse(res, result.todos, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

// 未读数量
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await ApprovalTodoService.getUnreadCount(req.user!.id);
    return successResponse(res, { count });
  })
);

// 标记已读
router.put(
  '/:id/read',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const todo = await ApprovalTodoService.markRead(req.params.id, req.user!.id);
    return successResponse(res, todo, '已标记已读');
  })
);

// 全部标记已读
router.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    await ApprovalTodoService.markAllRead(req.user!.id);
    return successResponse(res, null, '全部已标记已读');
  })
);

// 上传签名
router.post(
  '/upload-signature',
  signatureUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('请上传签名图片');
    }

    const url = `/uploads/signatures/${req.file.filename}`;
    return successResponse(res, {
      url,
      fileName: req.file.filename,
    }, '签名上传成功');
  })
);

// 推送待办通知（批量创建）
router.post(
  '/push',
  asyncHandler(async (req, res) => {
    const { userIds, type, referenceId, title } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('userIds必须是非空数组');
    }
    if (!type || !referenceId || !title) {
      throw new ValidationError('type、referenceId和title为必填项');
    }

    const todos = await ApprovalTodoService.pushToUsers(userIds, type, referenceId, title);

    return successResponse(res, {
      created: todos.length,
      todos,
    }, '待办推送成功');
  })
);

export default router;
