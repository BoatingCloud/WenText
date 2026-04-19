import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
            '/api/auth/refresh',
            { refreshToken }
          );

          if (response.data.success && response.data.data) {
            localStorage.setItem('accessToken', response.data.data.accessToken);
            localStorage.setItem('refreshToken', response.data.data.refreshToken);

            originalRequest.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
            return api(originalRequest);
          }
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }
    }

    const errorMessage = error.response?.data?.message || '请求失败，请稍后重试';
    console.error(`[API ERROR] ${errorMessage}`);

    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (data: { username: string; password: string }) =>
    api.post<ApiResponse<{ user: User; tokens: TokenPair }>>('/auth/login', data),

  register: (data: { username: string; email: string; password: string; name: string }) =>
    api.post<ApiResponse<User>>('/auth/register', data),

  logout: () => api.post<ApiResponse>('/auth/logout'),

  me: () => api.get<ApiResponse<User>>('/auth/me'),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    api.post<ApiResponse>('/auth/change-password', data),

  forgotPassword: (data: { email: string }) =>
    api.post<ApiResponse<{ code: string }>>('/auth/forgot-password', data),

  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    api.post<ApiResponse>('/auth/reset-password', data),

  adminResetPassword: (data: { userId: string; newPassword: string }) =>
    api.post<ApiResponse>('/auth/admin-reset-password', data),
};

export type ThemePresetId = 'cement-gray' | 'sea-salt-blue' | 'warm-sand' | 'jade-ink';

export interface ThemeConfig {
  siteName: string;
  themePreset: ThemePresetId;
}

export interface FondsCatalogItem {
  name: string;
  code: string;
}

export interface CompanyCatalogItem {
  name: string;
  code: string;
}

export type ArchiveBorrowMode = 'direct' | 'workflow';

export interface PublicSiteConfig extends ThemeConfig {
  siteDescription: string;
  allowRegister: boolean;
  companyCatalog: CompanyCatalogItem[];
  fondsCatalog: FondsCatalogItem[];
  archiveBorrowMode: ArchiveBorrowMode;
}

// AI配置相关类型
export type AIProvider = 'openai' | 'claude' | 'wenxin' | 'qwen' | 'spark' | 'zhipu' | 'custom';

export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  maxTokens: number;
  temperature: number;
}

export interface AIConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
}

export const systemConfigApi = {
  getPublicTheme: () => api.get<ApiResponse<PublicSiteConfig>>('/system-config/public'),
  getSettings: () => api.get<ApiResponse<Record<string, unknown>>>('/system-config/settings'),

  // AI配置相关
  getAIConfig: () => api.get<ApiResponse<AIConfig>>('/system-config/ai'),
  updateAIConfig: (data: Partial<AIConfig>) => api.put<ApiResponse<AIConfig>>('/system-config/ai', data),
  testAIConnection: (data: { provider: AIProvider; apiKey: string; apiEndpoint?: string; model?: string }) =>
    api.post<ApiResponse<AIConnectionTestResult>>('/system-config/ai/test', data),
};

export const userApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; departmentId?: string }) =>
    api.get<ApiResponse<User[]>>('/users', { params }),

  get: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),

  create: (data: Partial<User> & { roleIds?: string[] }) =>
    api.post<ApiResponse<User>>('/users', data),

  update: (id: string, data: Partial<User>) =>
    api.put<ApiResponse<User>>(`/users/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/users/${id}`),

  assignRoles: (id: string, roleIds: string[]) =>
    api.post<ApiResponse>(`/users/${id}/roles`, { roleIds }),

  batchAssignRoles: (userIds: string[], roleIds: string[]) =>
    api.post<ApiResponse>('/users/roles/batch', { userIds, roleIds }),

  // 用户数据权限（公司范围）
  getCompanyScopes: (id: string) =>
    api.get<ApiResponse<UserCompanyScopeResult>>(`/users/${id}/company-scopes`),

  // 用户仓库权限
  getRepositoryScopes: (id: string) =>
    api.get<ApiResponse<UserRepositoryScopeResult>>(`/users/${id}/repository-scopes`),

  // 用户实体档案权限
  getPhysicalArchiveScopes: (id: string) =>
    api.get<ApiResponse<UserPhysicalArchiveScopeResult>>(`/users/${id}/physical-archive-scopes`),

  setPhysicalArchiveScopes: (id: string, physicalArchiveIds: string[]) =>
    api.put<ApiResponse>(`/users/${id}/physical-archive-scopes`, { physicalArchiveIds }),
};

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  userCount?: number;
  children?: Department[];
}

export const departmentApi = {
  getTree: () => api.get<ApiResponse<Department[]>>('/departments/tree'),
};

export const roleApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get<ApiResponse<Role[]>>('/roles', { params }),

  get: (id: string) => api.get<ApiResponse<Role>>(`/roles/${id}`),

  create: (data: Partial<Role>) => api.post<ApiResponse<Role>>('/roles', data),

  update: (id: string, data: Partial<Role>) =>
    api.put<ApiResponse<Role>>(`/roles/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/roles/${id}`),

  getPermissions: (module?: string) =>
    api.get<ApiResponse<Permission[]>>('/roles/permissions', { params: { module } }),

  getRepositoryPermissions: (id: string) =>
    api.get<ApiResponse<RoleRepositoryPermission[]>>(`/roles/${id}/repositories`),

  updateRepositoryPermissions: (id: string, entries: RoleRepositoryPermissionInput[]) =>
    api.put<ApiResponse>(`/roles/${id}/repositories`, { entries }),
};

export const repositoryApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get<ApiResponse<Repository[]>>('/repositories', { params }),

  accessible: () => api.get<ApiResponse<Repository[]>>('/repositories/accessible'),

  get: (id: string) => api.get<ApiResponse<Repository>>(`/repositories/${id}`),

  create: (data: Partial<Repository>) =>
    api.post<ApiResponse<Repository>>('/repositories', data),

  update: (id: string, data: Partial<Repository>) =>
    api.put<ApiResponse<Repository>>(`/repositories/${id}`, data),

  delete: (id: string, permanent = false) =>
    api.delete<ApiResponse>(`/repositories/${id}`, { params: { permanent } }),

  setPermissions: (id: string, permissions: RepoPermission[]) =>
    api.post<ApiResponse>(`/repositories/${id}/permissions`, { permissions }),
};

export const physicalArchiveApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: string;
    status?: PhysicalArchiveStatus;
    workflowStatus?: ArchiveWorkflowStatus;
    year?: number;
    includeDestroyed?: boolean;
    companyCode?: string;
  }) => api.get<ApiResponse<PhysicalArchive[]>>('/physical-archives', { params }),

  get: (id: string) => api.get<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}`),

  create: (data: Partial<PhysicalArchive>) =>
    api.post<ApiResponse<PhysicalArchive>>('/physical-archives', data),

  update: (id: string, data: Partial<PhysicalArchive>) =>
    api.put<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/physical-archives/${id}`),

  borrow: (
    id: string,
    data: { borrower: string; borrowedAt?: string; dueAt?: string; borrowRemark?: string }
  ) => api.post<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}/borrow`, data),

  returnArchive: (
    id: string,
    data: { returnedAt?: string; returnRemark?: string }
  ) => api.post<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}/return`, data),

  listBorrowRecords: (id: string, params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<PhysicalArchiveBorrowRecord[]>>(`/physical-archives/${id}/borrow-records`, { params }),

  // 工作流动作
  submitReview: (id: string, comment?: string) =>
    api.post<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}/actions/submit-review`, { comment }),

  approveArchive: (id: string, reviewComment?: string) =>
    api.post<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}/actions/approve-archive`, { reviewComment }),

  rejectReview: (id: string, reviewComment: string) =>
    api.post<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}/actions/reject-review`, { reviewComment }),

  markModified: (id: string, reason?: string) =>
    api.post<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}/actions/mark-modified`, { reason }),

  destroy: (id: string, destroyReason: string) =>
    api.post<ApiResponse<PhysicalArchive>>(`/physical-archives/${id}/actions/destroy`, { destroyReason }),

  // 附件
  listAttachments: (id: string) =>
    api.get<ApiResponse<PhysicalArchiveAttachment[]>>(`/physical-archives/${id}/attachments`),

  uploadAttachments: (id: string, formData: FormData) =>
    api.post<ApiResponse<PhysicalArchiveAttachment[]>>(`/physical-archives/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteAttachment: (id: string, attachmentId: string) =>
    api.delete<ApiResponse>(`/physical-archives/${id}/attachments/${attachmentId}`),

  downloadAttachment: (id: string, attachmentId: string) =>
    api.get(`/physical-archives/${id}/attachments/${attachmentId}/download`, { responseType: 'blob' }),
};

// ── 档案分类 API ──

export interface ArchiveCategory {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
  level: number;
  sortOrder: number;
  description?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; name: string; code: string } | null;
  children?: ArchiveCategory[];
}

export const archiveCategoryApi = {
  list: () => api.get<ApiResponse<ArchiveCategory[]>>('/archive-categories'),
  getTree: () => api.get<ApiResponse<ArchiveCategory[]>>('/archive-categories', { params: { tree: 'true' } }),
  get: (id: string) => api.get<ApiResponse<ArchiveCategory>>(`/archive-categories/${id}`),
  create: (data: Partial<ArchiveCategory>) =>
    api.post<ApiResponse<ArchiveCategory>>('/archive-categories', data),
  update: (id: string, data: Partial<ArchiveCategory>) =>
    api.put<ApiResponse<ArchiveCategory>>(`/archive-categories/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/archive-categories/${id}`),
};

// ── 借阅工作流 API ──

export interface BorrowWorkflowNode {
  id: string;
  workflowId: string;
  name: string;
  nodeOrder: number;
  approverType: 'USER' | 'ROLE' | 'DEPARTMENT_HEAD';
  approverValue?: string;
  isRequired: boolean;
}

export interface BorrowWorkflowConfig {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isEnabled: boolean;
  nodes: BorrowWorkflowNode[];
  _count?: { requests: number };
  createdAt: string;
  updatedAt: string;
}

export const borrowWorkflowApi = {
  list: () => api.get<ApiResponse<BorrowWorkflowConfig[]>>('/borrow-workflows'),
  get: (id: string) => api.get<ApiResponse<BorrowWorkflowConfig>>(`/borrow-workflows/${id}`),
  create: (data: { name: string; description?: string; isDefault?: boolean; isEnabled?: boolean; nodes: Omit<BorrowWorkflowNode, 'id' | 'workflowId'>[] }) =>
    api.post<ApiResponse<BorrowWorkflowConfig>>('/borrow-workflows', data),
  update: (id: string, data: { name?: string; description?: string; isDefault?: boolean; isEnabled?: boolean; nodes?: Omit<BorrowWorkflowNode, 'id' | 'workflowId'>[] }) =>
    api.put<ApiResponse<BorrowWorkflowConfig>>(`/borrow-workflows/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/borrow-workflows/${id}`),
};

// ── 借阅申请 API ──

export type BorrowRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface BorrowApprovalRecord {
  id: string;
  requestId: string;
  nodeOrder: number;
  nodeName: string;
  approverId: string;
  approver: { id: string; name: string; username: string };
  action: 'APPROVE' | 'REJECT';
  comment?: string;
  signatureUrl?: string;
  createdAt: string;
}

export interface BorrowRequest {
  id: string;
  archiveId: string;
  archive: { id: string; title: string; archiveNo: string; shelfLocation: string; status: string };
  applicantId: string;
  applicant: { id: string; name: string; username: string };
  workflowId?: string;
  workflow?: { id: string; name: string; nodes?: BorrowWorkflowNode[] };
  status: BorrowRequestStatus;
  borrowReason?: string;
  expectedBorrowAt?: string;
  expectedReturnAt?: string;
  currentNodeOrder: number;
  completedAt?: string;
  approvalRecords: BorrowApprovalRecord[];
  createdAt: string;
  updatedAt: string;
}

export const borrowRequestApi = {
  create: (data: { archiveId: string; workflowId?: string; borrowReason?: string; expectedBorrowAt?: string; expectedReturnAt?: string }) =>
    api.post<ApiResponse<BorrowRequest>>('/borrow-requests', data),
  list: (params?: { page?: number; pageSize?: number; status?: BorrowRequestStatus; archiveId?: string }) =>
    api.get<ApiResponse<BorrowRequest[]>>('/borrow-requests', { params }),
  myPending: (params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<BorrowRequest[]>>('/borrow-requests/my-pending', { params }),
  myApplications: (params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<BorrowRequest[]>>('/borrow-requests/my-applications', { params }),
  get: (id: string) => api.get<ApiResponse<BorrowRequest>>(`/borrow-requests/${id}`),
  approve: (id: string, data: { comment?: string; signatureUrl?: string }) =>
    api.post<ApiResponse<BorrowRequest>>(`/borrow-requests/${id}/approve`, data),
  reject: (id: string, data: { comment: string; signatureUrl?: string }) =>
    api.post<ApiResponse<BorrowRequest>>(`/borrow-requests/${id}/reject`, data),
  cancel: (id: string) =>
    api.post<ApiResponse<BorrowRequest>>(`/borrow-requests/${id}/cancel`),
};

// ── 审批待办 API ──

export interface ApprovalTodo {
  id: string;
  userId: string;
  type: string;
  referenceId: string;
  title: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export const approvalTodoApi = {
  list: (params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) =>
    api.get<ApiResponse<ApprovalTodo[]>>('/approval-todos', { params: { ...params, unreadOnly: params?.unreadOnly ? 'true' : undefined } }),
  unreadCount: () => api.get<ApiResponse<{ count: number }>>('/approval-todos/unread-count'),
  markRead: (id: string) => api.put<ApiResponse<ApprovalTodo>>(`/approval-todos/${id}/read`),
  markAllRead: () => api.put<ApiResponse>('/approval-todos/read-all'),
  uploadSignature: (formData: FormData) =>
    api.post<ApiResponse<{ url: string; fileName: string }>>('/approval-todos/upload-signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  push: (data: { userIds: string[]; type: string; referenceId: string; title: string }) =>
    api.post<ApiResponse<{ created: number; todos: ApprovalTodo[] }>>('/approval-todos/push', data),
};

// 统计报表相关接口
export interface ArchiveStatistics {
  totalCount: number;
  byStatus: Record<PhysicalArchiveStatus, number>;
  byCompany: Array<{ companyCode: string; count: number }>;
  byCategory: Array<{ categoryId: string; categoryName: string; count: number }>;
  byFonds: Array<{ fondsName: string; count: number }>;
  byYear: Array<{ year: number; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
}

export interface DocumentStatistics {
  totalCount: number;
  totalSize: number;
  byRepository: Array<{ repositoryId: string; repositoryName: string; count: number; size: number }>;
  byType: Array<{ extension: string; count: number; size: number }>;
  byCreator: Array<{ creatorId: string; creatorName: string; count: number }>;
}

export interface BorrowStatistics {
  totalBorrowCount: number;
  totalReturnCount: number;
  currentBorrowedCount: number;
  byUser: Array<{ userId: string; userName: string; borrowCount: number; returnCount: number }>;
  byArchive: Array<{ archiveId: string; archiveTitle: string; borrowCount: number }>;
}

export interface StatisticsFilters {
  companyCode?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  fondsName?: string;
  status?: PhysicalArchiveStatus;
}

export const statisticsApi = {
  getArchiveStatistics: (filters: StatisticsFilters) =>
    api.get<ApiResponse<ArchiveStatistics>>('/statistics/archives', { params: filters }),

  getDocumentStatistics: (filters: Omit<StatisticsFilters, 'categoryId' | 'fondsName' | 'status'>) =>
    api.get<ApiResponse<DocumentStatistics>>('/statistics/documents', { params: filters }),

  getBorrowStatistics: (filters: Omit<StatisticsFilters, 'categoryId' | 'fondsName' | 'status'>) =>
    api.get<ApiResponse<BorrowStatistics>>('/statistics/borrows', { params: filters }),
};

// 统一借阅API
export const unifiedBorrowApi = {
  // 获取当前借阅模式
  getBorrowMode: () =>
    api.get<ApiResponse<{ mode: 'direct' | 'workflow'; modeLabel: string }>>('/unified-borrow/borrow-mode'),

  // 统一借阅接口（根据配置自动路由）
  borrow: (archiveId: string, data: { borrower?: string; borrowedAt?: string; dueAt?: string; remark?: string }) =>
    api.post<ApiResponse<any>>(`/unified-borrow/${archiveId}/borrow-unified`, data),

  // 统一归还接口
  return: (archiveId: string, data: { returnedAt?: string; remark?: string }) =>
    api.post<ApiResponse<any>>(`/unified-borrow/${archiveId}/return-unified`, data),

  // 获取借阅中的档案列表
  getBorrowedArchives: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get<ApiResponse<PhysicalArchive[]>>('/unified-borrow/borrowed-archives', { params }),
};

export const documentApi = {
  list: (repoId: string, params?: { path?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<Document[]>>(`/documents/repo/${repoId}`, { params }),

  get: (id: string) => api.get<ApiResponse<Document>>(`/documents/${id}`),

  getContent: (id: string) =>
    api.get<ApiResponse<DocumentContent>>(`/documents/${id}/content`),

  updateContent: (id: string, data: { content: string; commitMessage?: string }) =>
    api.put<ApiResponse<Document>>(`/documents/${id}/content`, data),

  upload: (repoId: string, formData: FormData) =>
    api.post<ApiResponse<Document>>(`/documents/repo/${repoId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  createFolder: (repoId: string, data: { name: string; parentPath: string }) =>
    api.post<ApiResponse<Document>>(`/documents/repo/${repoId}/folder`, data),

  download: (id: string) =>
    api.get(`/documents/${id}/download`, { responseType: 'blob' }),

  preview: (id: string) =>
    api.get(`/documents/${id}/preview`, { responseType: 'blob' }),

  previewUrl: (id: string) => `/api/documents/${id}/preview`,

  getOnlyOfficeConfig: (id: string) =>
    api.get<ApiResponse<DocumentOnlyOfficeConfig>>(`/documents/${id}/onlyoffice/config`),

  move: (id: string, targetPath: string) =>
    api.post<ApiResponse<Document>>(`/documents/${id}/move`, { targetPath }),

  rename: (id: string, name: string) =>
    api.post<ApiResponse<Document>>(`/documents/${id}/rename`, { name }),

  delete: (id: string, permanent = false) =>
    api.delete<ApiResponse>(`/documents/${id}`, { params: { permanent } }),

  getVersions: (id: string) => api.get<ApiResponse<DocumentVersion[]>>(`/documents/${id}/versions`),

  restoreVersion: (id: string, versionId: string) =>
    api.post<ApiResponse<Document>>(`/documents/${id}/versions/${versionId}/restore`),
};

export const shareApi = {
  list: (params?: { page?: number; pageSize?: number; documentId?: string }) =>
    api.get<ApiResponse<Share[]>>('/shares', { params }),

  get: (id: string) => api.get<ApiResponse<Share>>(`/shares/${id}`),

  create: (documentId: string, data: Partial<Share>) =>
    api.post<ApiResponse<Share>>(`/shares/document/${documentId}`, data),

  accessInfo: (code: string, password?: string) =>
    api.get<ApiResponse<ShareAccessInfo>>(
      `/shares/access/${code}`,
      { params: { hasPassword: password ? '1' : undefined, password } }
    ),

  access: (code: string, password?: string) =>
    api.post<ApiResponse<{ share: Share; document: Document }>>(`/shares/access/${code}`, { password }),

  downloadByCode: (code: string, password?: string) =>
    api.get(`/shares/access/${code}/download`, {
      params: { password },
      responseType: 'blob',
    }),

  disable: (id: string) => api.post<ApiResponse>(`/shares/${id}/disable`),

  delete: (id: string) => api.delete<ApiResponse>(`/shares/${id}`),
};

export const searchApi = {
  search: (params: {
    query: string;
    repositoryId?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<ApiResponse<SearchResult[]>>('/search', { params }),
};

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  departmentId?: string;
  department?: {
    id: string;
    name: string;
    code: string;
    parent?: {
      id: string;
      name: string;
      code: string;
      parent?: {
        id: string;
        name: string;
        code: string;
      } | null;
    } | null;
  } | null;
  roles: Role[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  description?: string;
  module: string;
}

export interface Repository {
  id: string;
  name: string;
  code: string;
  description?: string;
  companyCode?: string | null;
  storageType: string;
  storagePath: string;
  storageConfig?: Record<string, unknown>;
  versionEnabled: boolean;
  maxVersions: number;
  encryptEnabled: boolean;
  status: 'ACTIVE' | 'READONLY' | 'ARCHIVED' | 'DELETED';
  totalSize: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepoPermission {
  targetType: 'USER' | 'ROLE' | 'DEPARTMENT';
  targetId: string;
  permissions: string[];
  dataScope?: 'ALL' | 'DEPARTMENT' | 'PERSONAL' | 'CUSTOM';
  scopePaths?: string[];
}

export type PhysicalArchiveStatus = 'IN_STOCK' | 'BORROWED' | 'LOST' | 'DESTROYED';
export type ArchiveWorkflowStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ARCHIVED'
  | 'MODIFIED'
  | 'BORROWED'
  | 'RETURNED'
  | 'DESTROYED';
export type ArchiveVersionStatus = 'DRAFT' | 'FINAL' | 'ABOLISHED';

export interface PhysicalArchive {
  id: string;
  title: string;
  archiveNo: string;
  archiveCode?: string;
  subtitle?: string;
  categoryName?: string;
  categoryPath?: string;
  categoryId?: string;
  fondsName?: string;
  fondsCode?: string;
  year?: number;
  language?: string;
  carrierType?: string;
  archiveForm?: string;
  fileNo?: string;
  fileType?: string;
  responsibleParty?: string;
  responsibleCode?: string;
  filingDate?: string;
  effectiveDate?: string;
  invalidDate?: string;
  shelfLocation: string;
  retentionPeriod?: string;
  securityLevel?: string;
  formedAt?: string;
  expiresAt?: string;
  copies: number;
  pages?: number;
  attachmentCount?: number;
  summary?: string;
  keywords?: string[];
  subjectTerms?: string;
  documentGenre?: string;
  urgencyLevel?: string;
  workflowStatus?: ArchiveWorkflowStatus;
  filingDepartment?: string;
  responsibleUnit?: string;
  belongCategory?: string;
  transferDepartment?: string;
  transferPerson?: string;
  transferDate?: string;
  receiver?: string;
  receiveDate?: string;
  storageLocation?: string;
  shelfNo?: string;
  volumeNo?: string;
  itemNo?: string;
  controlMark?: string;
  appraisalStatus?: string;
  appraiser?: string;
  appraisalDate?: string;
  boxNo?: string;
  status: PhysicalArchiveStatus;
  borrower?: string;
  borrowedAt?: string;
  borrowRemark?: string;
  tags: string[];
  electronicFileId?: string;
  originalFileName?: string;
  fileExtension?: string;
  fileSizeBytes?: string | null;
  fileStoragePath?: string;
  storageMethod?: string;
  fileMd5?: string;
  ocrText?: string;
  thumbnailPath?: string;
  transferStatus?: string;
  digitizationStatus?: string;
  versionNo?: string;
  revisionNo?: number;
  previousVersionNo?: string;
  versionRemark?: string;
  versionStatus?: ArchiveVersionStatus;
  isCurrentVersion?: boolean;
  versionHistory?: string[];
  parentArchiveId?: string;
  rootArchiveId?: string;
  relatedArchiveIds?: string[];
  predecessorArchiveId?: string;
  successorArchiveId?: string;
  replacedArchiveId?: string;
  copiedFromArchiveId?: string;
  ownerName?: string;
  ownerDepartment?: string;
  accessLevel?: string;
  accessPolicy?: string;
  watermarkConfig?: string;
  encryptionAlgorithm?: string;
  encryptionStatus?: string;
  tamperProofHash?: string;
  creatorDepartment?: string;
  updatedById?: string;
  reviewer?: string;
  reviewedAt?: string;
  reviewComment?: string;
  filer?: string;
  filedAt?: string;
  destroyer?: string;
  destroyedAt?: string;
  destroyReason?: string;
  lastAccessedBy?: string;
  lastAccessedAt?: string;
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customNumber?: number;
  customDate?: string;
  extraJson?: Record<string, unknown>;
  remark?: string;
  companyCode?: string | null;
  creatorId: string;
  creator?: {
    id: string;
    name: string;
    username: string;
  };
  attachments?: PhysicalArchiveAttachment[];
  _count?: { attachments: number };
  createdAt: string;
  updatedAt: string;
}

export interface PhysicalArchiveAttachment {
  id: string;
  archiveId: string;
  fileName: string;
  fileExtension?: string;
  fileSize: string;
  mimeType?: string;
  storagePath: string;
  md5?: string;
  uploaderId: string;
  uploader?: { id: string; name: string; username: string };
  remark?: string;
  sortOrder: number;
  createdAt: string;
}

export interface PhysicalArchiveBorrowRecord {
  id: string;
  archiveId: string;
  action: 'BORROW' | 'RETURN';
  borrower?: string;
  borrowedAt?: string;
  returnedAt?: string;
  dueAt?: string;
  remark?: string;
  operatorId?: string;
  operator?: {
    id: string;
    name: string;
    username: string;
  };
  createdAt: string;
}

export interface RoleRepositoryPermissionInput {
  repositoryId: string;
  permissions: string[];
  dataScope?: 'ALL' | 'DEPARTMENT' | 'PERSONAL' | 'CUSTOM';
  scopePaths?: string[];
}

export interface RoleRepositoryPermission extends RoleRepositoryPermissionInput {
  repositoryName: string;
  repositoryCode: string;
}

export interface Document {
  id: string;
  repositoryId: string;
  parentId?: string;
  name: string;
  path: string;
  type: 'FILE' | 'FOLDER';
  mimeType?: string;
  size: number;
  md5?: string;
  extension?: string;
  isEncrypted: boolean;
  creatorId: string;
  creator?: { id: string; name: string; username: string };
  status: 'NORMAL' | 'DELETED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface DocumentContent {
  documentId: string;
  name: string;
  content: string;
  editable: boolean;
}

export interface DocumentOnlyOfficeConfig {
  documentId: string;
  name: string;
  scriptUrl: string;
  config: {
    document: {
      fileType: string;
      key: string;
      title: string;
      url: string;
      permissions: {
        edit: boolean;
        review: boolean;
        comment: boolean;
        download: boolean;
        print: boolean;
      };
    };
    documentType: 'word' | 'cell' | 'slide';
    editorConfig: {
      mode: 'edit' | 'view';
      callbackUrl: string;
      lang: string;
      user: {
        id: string;
        name: string;
      };
      customization?: Record<string, unknown>;
    };
    type?: string;
    width?: string;
    height?: string;
    token?: string;
  };
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  size: number;
  md5: string;
  storagePath: string;
  commitMessage?: string;
  creatorId: string;
  createdAt: string;
}

export interface Share {
  id: string;
  code: string;
  documentId: string;
  document?: Document;
  creatorId: string;
  shareType: 'PUBLIC' | 'PASSWORD' | 'INTERNAL';
  permissions: string[];
  expiresAt?: string;
  maxViews?: number;
  viewCount: number;
  downloadCount: number;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
  createdAt: string;
}

export type ShareAccessInfo =
  | {
      needPassword: true;
      shareType: 'PASSWORD';
    }
  | {
      share: Share;
      document: Document;
    };

export interface SearchResult {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  mimeType?: string;
  repositoryId: string;
  highlights?: string[];
  score?: number;
}

// 用户数据权限（公司范围）
export interface UserCompanyScopeResult {
  userId: string;
  isAllCompanies: boolean;
  companyCodes: string[];
}

// 用户仓库权限
export interface UserRepositoryScopeResult {
  userId: string;
  isAllRepositories: boolean;
  repositories: Array<{
    id: string;
    code: string;
    name: string;
    companyCode: string | null;
  }>;
}

// 用户实体档案权限
export interface UserPhysicalArchiveScopeResult {
  userId: string;
  isAllPhysicalArchives: boolean;
  physicalArchives: Array<{
    id: string;
    archiveNo: string;
    title: string;
    companyCode: string | null;
  }>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 文档审查相关类型和API
// ══════════════════════════════════════════════════════════════════════════════

export type DocumentReviewType = 'CONTRACT' | 'LAWYER_LETTER' | 'COLLECTION_LETTER' | 'AGREEMENT' | 'NOTICE' | 'OTHER';
export type ReviewStatus = 'DRAFT' | 'AI_REVIEWING' | 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AIReviewStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type AnnotationType = 'RISK' | 'KEY_POINT' | 'GAP' | 'COMPLIANCE' | 'SUGGESTION';
export type AnnotationStatus = 'ACTIVE' | 'RESOLVED' | 'IGNORED';

// AI审查结果类型
export interface AIReviewResult {
  reviewedAt: string;
  model: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  risks: Array<{
    category: string;
    severity: string;
    description: string;
    location: string;
    suggestion: string;
  }>;
  keyPoints: Array<{
    type: string;
    content: string;
    importance: string;
    note: string;
  }>;
  gaps: Array<{
    type: string;
    description: string;
    impact: string;
    recommendation: string;
  }>;
  compliance: Array<{
    item: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    detail: string;
  }>;
  summary: string;
  recommendations: string[];
}

export interface AIReviewStatusResponse {
  status: AIReviewStatus;
  result?: AIReviewResult;
  error?: string;
}


export interface DocumentReview {
  id: string;
  title: string;
  documentType: DocumentReviewType;
  initiatorId: string;
  initiator?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  departmentId?: string;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  departmentFullPath?: string;
  companyCode?: string;
  status: ReviewStatus;
  workflowId?: string;
  workflow?: {
    id: string;
    name: string;
    description?: string;
    isDefault: boolean;
    isEnabled: boolean;
  };
  currentNodeOrder: number;
  aiReviewStatus?: AIReviewStatus;
  aiReviewResult?: Record<string, unknown>;
  aiReviewedAt?: string;
  attachments?: DocumentReviewAttachment[];
  approvalRecords?: ReviewApprovalRecord[];
  annotations?: ManualReviewAnnotation[];
  _count?: {
    attachments: number;
    annotations: number;
    approvalRecords: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface DocumentReviewAttachment {
  id: string;
  reviewId: string;
  fileName: string;
  fileExtension?: string;
  fileSize: string;
  mimeType?: string;
  storagePath: string;
  md5?: string;
  uploaderId: string;
  uploader?: {
    id: string;
    name: string;
    avatar?: string;
  };
  sortOrder: number;
  createdAt: string;
}

export interface ReviewApprovalRecord {
  id: string;
  reviewId: string;
  nodeOrder: number;
  nodeName: string;
  approverId: string;
  approver?: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: 'APPROVE' | 'REJECT';
  comment?: string;
  signatureUrl?: string;
  createdAt: string;
}

export interface ManualReviewAnnotation {
  id: string;
  reviewId: string;
  attachmentId?: string;
  annotatorId: string;
  annotator?: {
    id: string;
    name: string;
    avatar?: string;
  };
  annotationType: AnnotationType;
  status: AnnotationStatus;
  category?: string;
  severity?: string;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  priority?: number;
  resolvedBy?: string;
  resolvedAt?: string;
  resolveNote?: string;
  comments?: AnnotationComment[];
  _count?: {
    comments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationComment {
  id: string;
  annotationId: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  createdAt: string;
}

export interface CreateDocumentReviewInput {
  title: string;
  documentType: DocumentReviewType;
  departmentId?: string;
  companyCode?: string;
  workflowId?: string;
}

export interface UpdateDocumentReviewInput {
  title?: string;
  documentType?: DocumentReviewType;
  departmentId?: string;
  companyCode?: string;
  workflowId?: string;
}

export interface ListDocumentReviewsParams {
  page?: number;
  pageSize?: number;
  status?: ReviewStatus;
  documentType?: DocumentReviewType;
  initiatorId?: string;
  companyCode?: string;
  startDate?: string;
  endDate?: string;
}

export const documentReviewApi = {
  // 基础CRUD
  list: (params?: ListDocumentReviewsParams) =>
    api.get<ApiResponse<DocumentReview[]>>('/document-reviews', { params }),

  get: (id: string) =>
    api.get<ApiResponse<DocumentReview>>(`/document-reviews/${id}`),

  create: (data: CreateDocumentReviewInput) =>
    api.post<ApiResponse<DocumentReview>>('/document-reviews', data),

  update: (id: string, data: UpdateDocumentReviewInput) =>
    api.put<ApiResponse<DocumentReview>>(`/document-reviews/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse>(`/document-reviews/${id}`),

  // 附件管理
  uploadAttachment: (id: string, formData: FormData) =>
    api.post<ApiResponse<DocumentReviewAttachment>>(`/document-reviews/${id}/attachments`, formData, {
      headers: { 'Content-Type': undefined },
    }),

  deleteAttachment: (id: string, attachmentId: string) =>
    api.delete<ApiResponse>(`/document-reviews/${id}/attachments/${attachmentId}`),

  downloadAttachment: (id: string, attachmentId: string) =>
    api.get(`/document-reviews/${id}/attachments/${attachmentId}/download`, { responseType: 'blob' }),

  // OnlyOffice 预览配置
  getAttachmentOnlyOfficeConfig: (id: string, attachmentId: string) =>
    api.get<ApiResponse<{
      attachmentId: string;
      name: string;
      scriptUrl: string;
      config: any;
    }>>(`/document-reviews/${id}/attachments/${attachmentId}/onlyoffice/config`),

  // 工作流操作
  submit: (id: string) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/submit`),

  approve: (id: string, data: { comment?: string; signatureUrl?: string }) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/approve`, data),

  reject: (id: string, data: { comment: string; signatureUrl?: string }) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/reject`, data),

  cancel: (id: string) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/cancel`),

  // AI审查
  triggerAIReview: (id: string) =>
    api.post<ApiResponse<{ reviewId: string; status: string }>>(`/document-reviews/${id}/ai-review`),

  getAIReviewResult: (id: string) =>
    api.get<ApiResponse<AIReviewStatusResponse>>(`/document-reviews/${id}/ai-review-result`),

  // 人工标注
  createAnnotation: (id: string, data: {
    attachmentId: string;
    annotationType: AnnotationType;
    pageNumber?: number;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    content: string;
    severity?: string;
  }) =>
    api.post<ApiResponse<ManualReviewAnnotation>>(`/document-reviews/${id}/annotations`, data),

  updateAnnotation: (id: string, annotationId: string, data: {
    content?: string;
    status?: AnnotationStatus;
    severity?: string;
  }) =>
    api.put<ApiResponse<ManualReviewAnnotation>>(`/document-reviews/${id}/annotations/${annotationId}`, data),

  deleteAnnotation: (id: string, annotationId: string) =>
    api.delete<ApiResponse>(`/document-reviews/${id}/annotations/${annotationId}`),

  // 标注评论
  addAnnotationComment: (id: string, annotationId: string, content: string) =>
    api.post<ApiResponse<AnnotationComment>>(`/document-reviews/${id}/annotations/${annotationId}/comments`, { content }),

  deleteAnnotationComment: (id: string, annotationId: string, commentId: string) =>
    api.delete<ApiResponse>(`/document-reviews/${id}/annotations/${annotationId}/comments/${commentId}`),
};
