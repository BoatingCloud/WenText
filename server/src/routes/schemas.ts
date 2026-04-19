import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export const registerSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50个字符'),
  phone: z.string().optional(),
  departmentId: z.string().uuid().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '原密码不能为空'),
  newPassword: z.string().min(6, '新密码至少6个字符').max(100, '新密码最多100个字符'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '刷新令牌不能为空'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  code: z.string().length(6, '验证码必须是6位数字').regex(/^\d{6}$/, '验证码必须是6位数字'),
  newPassword: z.string().min(6, '新密码至少6个字符').max(100, '新密码最多100个字符'),
});

export const adminResetPasswordSchema = z.object({
  userId: z.string().uuid('用户ID格式不正确'),
  newPassword: z.string().min(6, '新密码至少6个字符').max(100, '新密码最多100个字符'),
});

export const updateThemeConfigSchema = z.object({
  themePreset: z.enum(['cement-gray', 'sea-salt-blue', 'warm-sand', 'jade-ink']),
  siteName: z.string().min(1, '站点名称不能为空').max(100, '站点名称最多100个字符').optional(),
});

export const updateSiteSettingsSchema = z.object({
  siteName: z.string().min(1, '站点名称不能为空').max(100, '站点名称最多100个字符').optional(),
  siteDescription: z.string().max(200, '站点简介最多200个字符').optional(),
  groupName: z.string().min(1, '集团名称不能为空').max(100, '集团名称最多100个字符').optional(),
  themePreset: z.enum(['cement-gray', 'sea-salt-blue', 'warm-sand', 'jade-ink']).optional(),
  allowRegister: z.boolean().optional(),
  passwordMinLength: z.number().int().min(6).max(32).optional(),
  uploadMaxSizeMB: z.number().int().min(10).max(2048).optional(),
  defaultRepositoryBasePath: z.string().min(1).max(255).optional(),
  defaultRepositoryMaxVersions: z.number().int().min(1).max(1000).optional(),
  companyCatalog: z.array(
    z.object({
      name: z.string().min(1).max(100),
      code: z.string().min(1).max(50),
    })
  ).max(500).optional(),
  fondsCatalog: z.array(
    z.object({
      name: z.string().min(1).max(100),
      code: z.string().min(1).max(50),
    })
  ).max(200).optional(),
  archiveBorrowMode: z.enum(['direct', 'workflow']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少提供一个设置项',
});

// AI配置相关
export const updateAIConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['openai', 'claude', 'wenxin', 'qwen', 'spark', 'zhipu', 'custom']).optional(),
  apiKey: z.string().max(500).optional(),
  apiEndpoint: z.string().url('API端点必须是有效的URL').max(500).optional(),
  model: z.string().max(100).optional(),
  maxTokens: z.number().int().min(100, '最大Token数至少100').max(32000, '最大Token数不能超过32000').optional(),
  temperature: z.number().min(0, '温度参数最小为0').max(2, '温度参数最大为2').optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少提供一个配置项',
});

export const testAIConnectionSchema = z.object({
  provider: z.enum(['openai', 'claude', 'wenxin', 'qwen', 'spark', 'zhipu', 'custom']),
  apiKey: z.string().min(1, 'API密钥不能为空').max(500),
  apiEndpoint: z.string().url('API端点必须是有效的URL').max(500).optional(),
  model: z.string().max(100).optional(),
});

export const auditLogQuerySchema = z.object({
  page: z.string().default('1').transform(Number),
  pageSize: z.string().default('20').transform(Number),
  action: z.string().optional(),
  module: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).passthrough();

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(50),
  phone: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(50).optional(),
  phone: z.preprocess((val) => (val === null ? undefined : val), z.string().optional()),
  avatar: z.preprocess((val) => (val === null ? undefined : val), z.string().url().optional()),
  departmentId: z.preprocess((val) => (val === '' ? null : val), z.string().uuid().nullable().optional()),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
}).strip();

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(50),
  code: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '部门编码只能包含字母、数字、下划线和连字符'),
  description: z.string().max(255).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  parentId: z.string().uuid().optional(),
  organizationType: z.enum(['GROUP', 'COMPANY']).optional(),
}).refine((data) => data.parentId || data.organizationType, {
  message: '请提供上级节点或组织分类',
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  code: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '部门编码只能包含字母、数字、下划线和连字符').optional(),
  description: z.string().max(255).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少提供一个更新字段',
});

export const reorderDepartmentSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid(),
  index: z.number().int().min(0),
});

export const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  code: z.string().min(1).max(50),
  description: z.preprocess((val) => (val === null ? undefined : val), z.string().optional()),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.preprocess((val) => (val === null ? undefined : val), z.string().optional()),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export const updateRoleUsersSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

export const updateRoleRepositoryPermissionsSchema = z.object({
  entries: z.array(z.object({
    repositoryId: z.string().uuid(),
    permissions: z.array(z.string()).default([]),
    dataScope: z.enum(['ALL', 'DEPARTMENT', 'PERSONAL', 'CUSTOM']).optional(),
    scopePaths: z.array(z.string()).optional(),
  })),
});

export const updateRoleArchivePermissionsSchema = z.object({
  entries: z.array(z.object({
    companyCode: z.string().min(1).max(50),
    permissions: z.array(z.string()).default([]),
  })),
});

export const createRepositorySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '编码只能包含字母、数字、下划线和连字符'),
  description: z.string().optional(),
  companyCode: z.string().max(50).optional().nullable(),
  storageType: z.enum(['LOCAL', 'FTP', 'SFTP', 'SMB', 'SVN', 'GIT', 'MINIO', 'S3']),
  storagePath: z.string().min(1),
  storageConfig: z.record(z.unknown()).optional(),
  versionEnabled: z.boolean().default(true),
  maxVersions: z.number().int().min(1).max(1000).default(100),
  encryptEnabled: z.boolean().default(false),
  encryptAlgorithm: z.string().optional(),
});

export const updateRepositorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  companyCode: z.string().max(50).optional().nullable(),
  storageConfig: z.record(z.unknown()).optional(),
  versionEnabled: z.boolean().optional(),
  maxVersions: z.number().int().min(1).max(1000).optional(),
  encryptEnabled: z.boolean().optional(),
  encryptAlgorithm: z.string().optional(),
  status: z.enum(['ACTIVE', 'READONLY', 'ARCHIVED']).optional(),
}).strip();

export const repoPermissionSchema = z.object({
  permissions: z.array(z.object({
    targetType: z.enum(['USER', 'ROLE', 'DEPARTMENT']),
    targetId: z.string().uuid(),
    permissions: z.array(z.string()),
    dataScope: z.enum(['ALL', 'DEPARTMENT', 'PERSONAL', 'CUSTOM']).optional(),
    scopePaths: z.array(z.string()).optional(),
  })),
});

export const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentPath: z.string().default('/'),
});

export const moveDocumentSchema = z.object({
  targetPath: z.string().min(1),
});

export const renameDocumentSchema = z.object({
  name: z.string().min(1).max(255),
});

export const createShareSchema = z.object({
  shareType: z.enum(['PUBLIC', 'PASSWORD', 'INTERNAL']),
  password: z.string().min(4).max(20).optional(),
  permissions: z.array(z.string()).default(['view']),
  expiresAt: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  maxViews: z.number().int().min(1).optional(),
});

export const accessShareSchema = z.object({
  password: z.string().optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1),
  repositoryId: z.string().uuid().optional(),
  type: z.enum(['file', 'folder', 'all']).optional(),
  extensions: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const paginationSchema = z.object({
  page: z.string().default('1').transform(Number),
  pageSize: z.string().default('20').transform(Number),
}).passthrough();

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const physicalArchiveStatusSchema = z.enum(['IN_STOCK', 'BORROWED', 'LOST', 'DESTROYED']);
export const archiveWorkflowStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'ARCHIVED',
  'MODIFIED',
  'BORROWED',
  'RETURNED',
  'DESTROYED',
]);
export const archiveVersionStatusSchema = z.enum(['DRAFT', 'FINAL', 'ABOLISHED']);

const physicalArchiveBaseSchema = z.object({
  title: z.string().min(1).max(200),
  archiveNo: z.string().min(1).max(100),
  archiveCode: z.string().max(100).optional(),
  subtitle: z.string().max(300).optional(),
  categoryName: z.string().max(100).optional(),
  categoryPath: z.string().max(500).optional(),
  categoryId: z.string().max(100).optional(),
  fondsName: z.string().max(100).optional(),
  fondsCode: z.string().max(50).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  language: z.string().max(30).optional(),
  carrierType: z.string().max(30).optional(),
  archiveForm: z.string().max(30).optional(),
  fileNo: z.string().max(100).optional(),
  fileType: z.string().max(100).optional(),
  responsibleParty: z.string().max(100).optional(),
  responsibleCode: z.string().max(50).optional(),
  filingDate: z.coerce.date().optional(),
  effectiveDate: z.coerce.date().optional(),
  invalidDate: z.coerce.date().optional(),
  shelfLocation: z.string().min(1).max(100),
  retentionPeriod: z.string().max(50).optional(),
  securityLevel: z.string().max(50).optional(),
  formedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  copies: z.number().int().min(1).max(999).default(1),
  pages: z.number().int().min(0).max(100000).optional(),
  attachmentCount: z.number().int().min(0).max(9999).optional(),
  summary: z.string().max(1000).optional(),
  keywords: z.array(z.string().min(1).max(50)).max(50).default([]),
  subjectTerms: z.string().max(300).optional(),
  documentGenre: z.string().max(50).optional(),
  urgencyLevel: z.string().max(30).optional(),
  workflowStatus: archiveWorkflowStatusSchema.default('DRAFT'),
  filingDepartment: z.string().max(100).optional(),
  responsibleUnit: z.string().max(100).optional(),
  belongCategory: z.string().max(100).optional(),
  transferDepartment: z.string().max(100).optional(),
  transferPerson: z.string().max(100).optional(),
  transferDate: z.coerce.date().optional(),
  receiver: z.string().max(100).optional(),
  receiveDate: z.coerce.date().optional(),
  storageLocation: z.string().max(200).optional(),
  shelfNo: z.string().max(100).optional(),
  volumeNo: z.string().max(100).optional(),
  itemNo: z.string().max(100).optional(),
  controlMark: z.string().max(100).optional(),
  appraisalStatus: z.string().max(50).optional(),
  appraiser: z.string().max(100).optional(),
  appraisalDate: z.coerce.date().optional(),
  boxNo: z.string().max(100).optional(),
  status: physicalArchiveStatusSchema.default('IN_STOCK'),
  borrower: z.string().max(100).optional(),
  borrowedAt: z.coerce.date().optional(),
  borrowRemark: z.string().max(500).optional(),
  tags: z.array(z.string().min(1).max(30)).max(20).default([]),
  electronicFileId: z.string().max(100).optional(),
  originalFileName: z.string().max(255).optional(),
  fileExtension: z.string().max(20).optional(),
  fileSizeBytes: z.union([z.string(), z.number()])
    .transform((val) => (val != null ? String(val) : undefined))
    .optional(),
  fileStoragePath: z.string().max(500).optional(),
  storageMethod: z.string().max(50).optional(),
  fileMd5: z.string().max(64).optional(),
  ocrText: z.string().optional(),
  thumbnailPath: z.string().max(500).optional(),
  transferStatus: z.string().max(50).optional(),
  digitizationStatus: z.string().max(50).optional(),
  versionNo: z.string().max(20).default('V1.0'),
  revisionNo: z.number().int().min(1).default(1),
  previousVersionNo: z.string().max(20).optional(),
  versionRemark: z.string().max(1000).optional(),
  versionStatus: archiveVersionStatusSchema.default('FINAL'),
  isCurrentVersion: z.boolean().default(true),
  versionHistory: z.array(z.string().max(100)).max(200).default([]),
  parentArchiveId: z.string().uuid().optional(),
  rootArchiveId: z.string().uuid().optional(),
  relatedArchiveIds: z.array(z.string().uuid()).max(200).default([]),
  predecessorArchiveId: z.string().uuid().optional(),
  successorArchiveId: z.string().uuid().optional(),
  replacedArchiveId: z.string().uuid().optional(),
  copiedFromArchiveId: z.string().uuid().optional(),
  ownerName: z.string().max(100).optional(),
  ownerDepartment: z.string().max(100).optional(),
  accessLevel: z.string().max(50).optional(),
  accessPolicy: z.string().max(1000).optional(),
  watermarkConfig: z.string().max(500).optional(),
  encryptionAlgorithm: z.string().max(100).optional(),
  encryptionStatus: z.string().max(50).optional(),
  tamperProofHash: z.string().max(500).optional(),
  creatorDepartment: z.string().max(100).optional(),
  updatedById: z.string().uuid().optional(),
  reviewer: z.string().max(100).optional(),
  reviewedAt: z.coerce.date().optional(),
  reviewComment: z.string().max(1000).optional(),
  filer: z.string().max(100).optional(),
  filedAt: z.coerce.date().optional(),
  destroyer: z.string().max(100).optional(),
  destroyedAt: z.coerce.date().optional(),
  destroyReason: z.string().max(1000).optional(),
  lastAccessedBy: z.string().max(100).optional(),
  lastAccessedAt: z.coerce.date().optional(),
  customText1: z.string().max(255).optional(),
  customText2: z.string().max(255).optional(),
  customText3: z.string().max(255).optional(),
  customNumber: z.number().optional(),
  customDate: z.coerce.date().optional(),
  extraJson: z.record(z.unknown()).optional(),
  remark: z.string().max(1000).optional(),
  companyCode: z.string().max(50).optional(),
});

export const createPhysicalArchiveSchema = physicalArchiveBaseSchema.superRefine((data, ctx) => {
  if (data.status === 'BORROWED' && !data.borrower) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '状态为 BORROWED 时必须填写借阅人',
      path: ['borrower'],
    });
  }
});

export const updatePhysicalArchiveSchema = z.preprocess(
  // 将所有 null 值转换为 undefined，因为前端可能传递 null
  (data) => {
    if (typeof data !== 'object' || data === null) return data;
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = value === null ? undefined : value;
    }
    return cleaned;
  },
  physicalArchiveBaseSchema.partial()
    .extend({
      borrowedAt: z.coerce.date().nullable().optional(),
      formedAt: z.coerce.date().nullable().optional(),
      expiresAt: z.coerce.date().nullable().optional(),
      filingDate: z.coerce.date().nullable().optional(),
      effectiveDate: z.coerce.date().nullable().optional(),
      invalidDate: z.coerce.date().nullable().optional(),
      transferDate: z.coerce.date().nullable().optional(),
      receiveDate: z.coerce.date().nullable().optional(),
      appraisalDate: z.coerce.date().nullable().optional(),
      reviewedAt: z.coerce.date().nullable().optional(),
      filedAt: z.coerce.date().nullable().optional(),
      destroyedAt: z.coerce.date().nullable().optional(),
      lastAccessedAt: z.coerce.date().nullable().optional(),
      customDate: z.coerce.date().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: '至少提供一个更新字段',
    })
);

export const physicalArchiveQuerySchema = z.object({
  page: z.string().default('1').transform(Number),
  pageSize: z.string().default('20').transform(Number),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  status: physicalArchiveStatusSchema.optional(),
  workflowStatus: archiveWorkflowStatusSchema.optional(),
  year: z.string().transform((value) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Number(trimmed);
  }).optional(),
  includeDestroyed: z.string().transform((v) => v === 'true').optional(),
  companyCode: z.string().optional(),
}).passthrough();

export const borrowPhysicalArchiveSchema = z.object({
  borrower: z.string().min(1).max(100),
  borrowedAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  borrowRemark: z.string().max(500).optional(),
});

export const returnPhysicalArchiveSchema = z.object({
  returnedAt: z.coerce.date().optional(),
  returnRemark: z.string().max(500).optional(),
});

// 动作型 Schema
export const submitReviewSchema = z.object({
  comment: z.string().max(1000).optional(),
});

export const approveArchiveSchema = z.object({
  reviewComment: z.string().max(1000).optional(),
});

export const rejectReviewSchema = z.object({
  reviewComment: z.string().min(1, '驳回原因不能为空').max(1000),
});

export const markModifiedSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export const destroyPhysicalArchiveSchema = z.object({
  destroyReason: z.string().min(1, '销毁原因不能为空').max(1000),
});

// ── 档案分类 ──

export const createArchiveCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(100),
  code: z.string().min(1, '分类编码不能为空').max(50).regex(/^[a-zA-Z0-9_-]+$/, '编码只能包含字母、数字、下划线和连字符'),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  description: z.string().max(255).optional(),
  isEnabled: z.boolean().optional(),
});

export const updateArchiveCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '编码只能包含字母、数字、下划线和连字符').optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  description: z.string().max(255).optional(),
  isEnabled: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少提供一个更新字段',
});

// ── 借阅工作流配置 ──

const workflowNodeSchema = z.object({
  name: z.string().min(1).max(100),
  nodeOrder: z.number().int().min(1),
  approverType: z.enum(['USER', 'ROLE', 'DEPARTMENT_HEAD']),
  approverValue: z.string().max(200).optional(),
  isRequired: z.boolean().optional(),
});

export const createBorrowWorkflowSchema = z.object({
  name: z.string().min(1, '工作流名称不能为空').max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  nodes: z.array(workflowNodeSchema).min(1, '至少配置一个审批节点'),
});

export const updateBorrowWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  nodes: z.array(workflowNodeSchema).min(1).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少提供一个更新字段',
});

// ── 借阅申请 ──

export const createBorrowRequestSchema = z.object({
  archiveId: z.string().uuid(),
  workflowId: z.string().uuid().optional(),
  borrowReason: z.string().max(1000).optional(),
  expectedBorrowAt: z.coerce.date().optional(),
  expectedReturnAt: z.coerce.date().optional(),
});

export const borrowRequestQuerySchema = z.object({
  page: z.string().default('1').transform(Number),
  pageSize: z.string().default('20').transform(Number),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  archiveId: z.string().uuid().optional(),
}).passthrough();

export const approveBorrowRequestSchema = z.object({
  comment: z.string().max(1000).optional(),
  signatureUrl: z.string().min(1, '签名不能为空').max(500000),
});

export const rejectBorrowRequestSchema = z.object({
  comment: z.string().min(1, '驳回原因不能为空').max(1000),
  signatureUrl: z.string().min(1, '签名不能为空').max(500000),
});

// ══════════════════════════════════════════════════════════════════════════════
// 文档审查相关Schema
// ══════════════════════════════════════════════════════════════════════════════

export const createDocumentReviewSchema = z.object({
  title: z.string().min(1, '文件标题不能为空').max(200, '文件标题最多200个字符'),
  documentType: z.enum(['CONTRACT', 'LAWYER_LETTER', 'COLLECTION_LETTER', 'AGREEMENT', 'NOTICE', 'OTHER'], {
    errorMap: () => ({ message: '文件类型不正确' }),
  }),
  departmentId: z.string().uuid('部门ID格式不正确').optional(),
  companyCode: z.string().max(50, '公司代码最多50个字符').optional(),
  workflowId: z.string().uuid('工作流ID格式不正确').optional(),
});

export const updateDocumentReviewSchema = z.object({
  title: z.string().min(1, '文件标题不能为空').max(200, '文件标题最多200个字符').optional(),
  documentType: z.enum(['CONTRACT', 'LAWYER_LETTER', 'COLLECTION_LETTER', 'AGREEMENT', 'NOTICE', 'OTHER']).optional(),
  departmentId: z.string().uuid('部门ID格式不正确').optional(),
  companyCode: z.string().max(50, '公司代码最多50个字符').optional(),
  workflowId: z.string().uuid('工作流ID格式不正确').optional(),
});

