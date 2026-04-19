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
  groupName: string;
  allowRegister: boolean;
  companyCatalog: CompanyCatalogItem[];
  fondsCatalog: FondsCatalogItem[];
  archiveBorrowMode: ArchiveBorrowMode;
}

export interface SiteSettings extends PublicSiteConfig {
  passwordMinLength: number;
  uploadMaxSizeMB: number;
  defaultRepositoryBasePath: string;
  defaultRepositoryMaxVersions: number;
}

export const systemConfigApi = {
  getPublicTheme: () => api.get<ApiResponse<PublicSiteConfig>>('/system-config/public'),
  getTheme: () => api.get<ApiResponse<ThemeConfig>>('/system-config/theme'),
  updateTheme: (data: Partial<ThemeConfig> & { themePreset: ThemePresetId }) =>
    api.put<ApiResponse<ThemeConfig>>('/system-config/theme', data),
  getSettings: () => api.get<ApiResponse<SiteSettings>>('/system-config/settings'),
  updateSettings: (data: Partial<SiteSettings>) =>
    api.put<ApiResponse<SiteSettings>>('/system-config/settings', data),
};

export type OrganizationType = 'GROUP' | 'COMPANY';

export const departmentApi = {
  getTree: () => api.get<ApiResponse<Department[]>>('/departments/tree'),

  create: (data: Partial<Department> & { organizationType?: OrganizationType; parentId?: string }) =>
    api.post<ApiResponse<Department>>('/departments', data),

  update: (id: string, data: Partial<Department>) =>
    api.put<ApiResponse<Department>>(`/departments/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/departments/${id}`),

  reorder: (payload: { id: string; parentId: string; index: number }) =>
    api.patch<ApiResponse>('/departments/reorder', payload),
};

export const userApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
    departmentId?: string;
    organizationType?: OrganizationType;
  }) =>
    api.get<ApiResponse<User[]>>('/users', { params }),

  get: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),

  create: (data: Partial<User> & { password?: string; roleIds?: string[]; departmentId?: string }) =>
    api.post<ApiResponse<User>>('/users', data),

  update: (
    id: string,
    data: {
      email?: string;
      name?: string;
      phone?: string;
      avatar?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
      departmentId?: string | null;
    }
  ) =>
    api.put<ApiResponse<User>>(`/users/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/users/${id}`),

  assignRoles: (id: string, roleIds: string[]) =>
    api.post<ApiResponse>(`/users/${id}/roles`, { roleIds }),

  batchAssignRoles: (userIds: string[], roleIds: string[]) =>
    api.post<ApiResponse>('/users/roles/batch', { userIds, roleIds }),

  // 用户数据权限（公司范围）
  getCompanyScopes: (id: string) =>
    api.get<ApiResponse<UserCompanyScopeResult>>(`/users/${id}/company-scopes`),

  updateCompanyScopes: (id: string, companyCodes: string[]) =>
    api.put<ApiResponse>(`/users/${id}/company-scopes`, { companyCodes }),

  // 用户仓库权限
  getRepositoryScopes: (id: string) =>
    api.get<ApiResponse<UserRepositoryScopeResult>>(`/users/${id}/repository-scopes`),

  updateRepositoryScopes: (id: string, repositoryIds: string[]) =>
    api.put<ApiResponse>(`/users/${id}/repository-scopes`, { repositoryIds }),

  // 用户档案权限
  getArchiveScopes: (id: string) =>
    api.get<ApiResponse<UserArchiveScopeResult>>(`/users/${id}/archive-scopes`),

  updateArchiveScopes: (id: string, companyCodes: string[]) =>
    api.put<ApiResponse>(`/users/${id}/archive-scopes`, { companyCodes }),
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

  getArchivePermissions: (id: string) =>
    api.get<ApiResponse<RoleArchivePermission[]>>(`/roles/${id}/archives`),

  updateArchivePermissions: (id: string, entries: RoleArchivePermissionInput[]) =>
    api.put<ApiResponse>(`/roles/${id}/archives`, { entries }),

  getUsers: (id: string) =>
    api.get<ApiResponse<RoleUser[]>>(`/roles/${id}/users`),

  updateUsers: (id: string, userIds: string[]) =>
    api.put<ApiResponse>(`/roles/${id}/users`, { userIds }),
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
};

export const documentApi = {
  list: (repoId: string, params?: { path?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<Document[]>>(`/documents/repo/${repoId}`, { params }),

  get: (id: string) => api.get<ApiResponse<Document>>(`/documents/${id}`),

  upload: (repoId: string, formData: FormData) =>
    api.post<ApiResponse<Document>>(`/documents/repo/${repoId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  createFolder: (repoId: string, data: { name: string; parentPath: string }) =>
    api.post<ApiResponse<Document>>(`/documents/repo/${repoId}/folder`, data),

  download: (id: string) =>
    api.get(`/documents/${id}/download`, { responseType: 'blob' }),

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

  access: (code: string, password?: string) =>
    api.post<ApiResponse<{ share: Share; document: Document }>>(`/shares/access/${code}`, { password }),

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

export const reviewWorkflowApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    documentType?: string;
    isEnabled?: boolean;
  }) => api.get<ApiResponse<ReviewWorkflowConfig[]>>('/review-workflows', { params }),

  get: (id: string) => api.get<ApiResponse<ReviewWorkflowConfig>>(`/review-workflows/${id}`),

  create: (data: {
    name: string;
    description?: string;
    documentType?: string;
    isDefault?: boolean;
    isEnabled?: boolean;
    nodes: Array<{
      name: string;
      nodeOrder: number;
      approverType: 'USER' | 'ROLE' | 'DEPARTMENT_HEAD';
      approverValue?: string;
      isRequired?: boolean;
    }>;
  }) => api.post<ApiResponse<ReviewWorkflowConfig>>('/review-workflows', data),

  update: (id: string, data: {
    name?: string;
    description?: string;
    documentType?: string;
    isDefault?: boolean;
    isEnabled?: boolean;
    nodes?: Array<{
      id?: string;
      name: string;
      nodeOrder: number;
      approverType: 'USER' | 'ROLE' | 'DEPARTMENT_HEAD';
      approverValue?: string;
      isRequired?: boolean;
    }>;
  }) => api.put<ApiResponse<ReviewWorkflowConfig>>(`/review-workflows/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/review-workflows/${id}`),

  toggleEnabled: (id: string, isEnabled: boolean) =>
    api.patch<ApiResponse<ReviewWorkflowConfig>>(`/review-workflows/${id}/toggle`, { isEnabled }),

  setDefault: (id: string) =>
    api.patch<ApiResponse<ReviewWorkflowConfig>>(`/review-workflows/${id}/set-default`),

  getDefault: (documentType?: string) =>
    api.get<ApiResponse<ReviewWorkflowConfig>>('/review-workflows/default', {
      params: { documentType },
    }),
};

// 文档审查类型
export type DocumentReviewType = 'CONTRACT' | 'LAWYER_LETTER' | 'COLLECTION_LETTER' | 'AGREEMENT' | 'NOTICE' | 'OTHER';
export type ReviewStatus = 'DRAFT' | 'AI_REVIEWING' | 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AIReviewStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// 文档审查附件
export interface DocumentReviewAttachment {
  id: string;
  reviewId: string;
  fileName: string;
  fileExtension?: string;
  fileSize: number;
  mimeType?: string;
  storagePath: string;
  md5: string;
  uploaderId: string;
  uploader?: {
    id: string;
    name: string;
    avatar?: string;
  };
  extractedText?: string;
  createdAt: string;
}

// 文档审查
export interface DocumentReview {
  id: string;
  title: string;
  documentType: DocumentReviewType;
  initiatorId: string;
  initiator?: {
    id: string;
    name: string;
    avatar?: string;
  };
  departmentId?: string;
  department?: {
    id: string;
    name: string;
  };
  companyCode?: string;
  status: ReviewStatus;
  workflowId?: string;
  workflow?: ReviewWorkflowConfig;
  currentNodeOrder: number;
  aiReviewStatus?: AIReviewStatus;
  aiReviewResult?: any;
  aiReviewedAt?: string;
  attachments?: DocumentReviewAttachment[];
  annotations?: ManualReviewAnnotation[];
  approvalRecords?: any[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// 文档审查API
export const documentReviewApi = {
  // 获取列表
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: ReviewStatus;
    documentType?: DocumentReviewType;
    companyCode?: string;
  }) => api.get<ApiResponse<DocumentReview[]>>('/document-reviews', { params }),

  // 获取详情
  get: (id: string) => api.get<ApiResponse<DocumentReview>>(`/document-reviews/${id}`),

  // 创建
  create: (data: {
    title: string;
    documentType: DocumentReviewType;
    departmentId?: string;
    companyCode?: string;
  }) => api.post<ApiResponse<DocumentReview>>('/document-reviews', data),

  // 更新
  update: (id: string, data: {
    title?: string;
    documentType?: DocumentReviewType;
    departmentId?: string;
    companyCode?: string;
  }) => api.put<ApiResponse<DocumentReview>>(`/document-reviews/${id}`, data),

  // 删除
  delete: (id: string) => api.delete<ApiResponse>(`/document-reviews/${id}`),

  // 触发AI审查
  triggerAIReview: (id: string) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/ai-review`),

  // 获取AI审查结果
  getAIReviewResult: (id: string) =>
    api.get<ApiResponse<any>>(`/document-reviews/${id}/ai-review-result`),

  // 上传附件
  uploadAttachment: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<DocumentReviewAttachment>>(
      `/document-reviews/${id}/attachments`,
      formData
    );
  },

  // 获取附件列表
  getAttachments: (id: string) =>
    api.get<ApiResponse<DocumentReviewAttachment[]>>(`/document-reviews/${id}/attachments`),

  // 删除附件
  deleteAttachment: (reviewId: string, attachmentId: string) =>
    api.delete<ApiResponse>(`/document-reviews/${reviewId}/attachments/${attachmentId}`),

  // 提交审批
  submitForApproval: (id: string) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/submit`),

  // 审批通过
  approve: (id: string, data: { comment?: string; signatureUrl?: string }) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/approve`, data),

  // 审批驳回
  reject: (id: string, data: { comment: string; signatureUrl?: string }) =>
    api.post<ApiResponse<DocumentReview>>(`/document-reviews/${id}/reject`, data),

  // 获取待我审批的列表
  getPendingApprovals: () =>
    api.get<ApiResponse<DocumentReview[]>>('/document-reviews/pending-approvals'),
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
  department?: Department | null;
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
  userCount?: number;
  permissions: Permission[];
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
  parentId?: string | null;
  organizationType?: OrganizationType;
  nodeType?: 'ROOT' | 'COMPANY_ROOT' | 'COMPANY' | 'DEPARTMENT';
  userCount?: number;
  isRoot?: boolean;
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
  children?: Department[];
}

export interface RoleUser {
  id: string;
  username: string;
  name: string;
  email: string;
  departmentId?: string | null;
  departmentName?: string | null;
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

export interface RoleArchivePermissionInput {
  companyCode: string;
  permissions: string[];
}

export interface RoleArchivePermission extends RoleArchivePermissionInput {
  companyName: string;
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

// 用户档案权限
export interface UserArchiveScopeResult {
  userId: string;
  isAllCompanies: boolean;
  companyCodes: string[];
}

// 审查工作流
export interface ReviewWorkflowNode {
  id: string;
  workflowId: string;
  name: string;
  nodeOrder: number;
  approverType: 'USER' | 'ROLE' | 'DEPARTMENT_HEAD';
  approverValue?: string;
  isRequired: boolean;
}

export interface ReviewWorkflowConfig {
  id: string;
  name: string;
  description?: string;
  documentType?: string;
  isDefault: boolean;
  isEnabled: boolean;
  nodes: ReviewWorkflowNode[];
  _count?: {
    reviews: number;
  };
  createdAt: string;
  updatedAt: string;
}

// 标注类型
export type AnnotationType = 'RISK' | 'KEY_POINT' | 'GAP' | 'COMPLIANCE' | 'SUGGESTION';
export type AnnotationStatus = 'ACTIVE' | 'RESOLVED' | 'IGNORED';

// 标注评论
export interface AnnotationComment {
  id: string;
  annotationId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  createdAt: string;
}

// 标注
export interface ManualReviewAnnotation {
  id: string;
  reviewId: string;
  annotatorId: string;
  annotator: {
    id: string;
    name: string;
    avatar?: string;
  };
  annotationType: AnnotationType;
  category?: string;
  severity?: string;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  status: AnnotationStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  resolveNote?: string;
  priority: number;
  comments?: AnnotationComment[];
  _count?: {
    comments: number;
  };
  createdAt: string;
  updatedAt: string;
}

// 标注统计
export interface AnnotationStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

// 标注API
export const annotationApi = {
  // 创建标注
  create: (data: {
    reviewId: string;
    annotationType: AnnotationType;
    category?: string;
    severity?: string;
    title: string;
    description: string;
    location?: string;
    suggestion?: string;
    priority?: number;
  }) => api.post<ApiResponse<ManualReviewAnnotation>>('/annotations', data),

  // 获取标注列表
  list: (params: {
    reviewId: string;
    annotationType?: AnnotationType;
    status?: AnnotationStatus;
    priority?: number;
  }) => api.get<ApiResponse<ManualReviewAnnotation[]>>('/annotations', { params }),

  // 获取单个标注
  get: (id: string) => api.get<ApiResponse<ManualReviewAnnotation>>(`/annotations/${id}`),

  // 更新标注
  update: (id: string, data: {
    annotationType?: AnnotationType;
    category?: string;
    severity?: string;
    title?: string;
    description?: string;
    location?: string;
    suggestion?: string;
    priority?: number;
    status?: AnnotationStatus;
  }) => api.put<ApiResponse<ManualReviewAnnotation>>(`/annotations/${id}`, data),

  // 删除标注
  delete: (id: string) => api.delete<ApiResponse>(`/annotations/${id}`),

  // 解决标注
  resolve: (id: string, data: { resolveNote?: string }) =>
    api.patch<ApiResponse<ManualReviewAnnotation>>(`/annotations/${id}/resolve`, data),

  // 忽略标注
  ignore: (id: string) =>
    api.patch<ApiResponse<ManualReviewAnnotation>>(`/annotations/${id}/ignore`),

  // 重新激活标注
  reactivate: (id: string) =>
    api.patch<ApiResponse<ManualReviewAnnotation>>(`/annotations/${id}/reactivate`),

  // 添加评论
  addComment: (id: string, data: { content: string }) =>
    api.post<ApiResponse<AnnotationComment>>(`/annotations/${id}/comments`, data),

  // 删除评论
  deleteComment: (commentId: string) =>
    api.delete<ApiResponse>(`/annotations/comments/${commentId}`),

  // 获取统计信息
  getStats: (reviewId: string) =>
    api.get<ApiResponse<AnnotationStats>>('/annotations/stats', { params: { reviewId } }),
};
