# API 文档

本文档基于当前代码实现整理，路由入口见 `server/src/routes/index.ts`，统一前缀为 `/api`。

## 基础约定

### 鉴权

- 登录后通过 `Authorization: Bearer <token>` 访问受保护接口
- 少量公共接口不要求认证，如 `/api/health`、部分分享访问接口、系统公开配置接口

### 统一响应

```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "code": "OPTIONAL_CODE",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 权限模型

- 权限格式采用 `resource:action`
- 常见权限包括 `user:view`、`repo:manage`、`doc:view`、`archive:borrow`、`doc-review:approve`
- 部分接口支持多权限任选其一

## 健康检查

### `GET /api/health`

- 用途：检查服务状态
- 认证：否

## 认证与账户

基础路由：`/api/auth`

### 主要接口

- `POST /login`：登录
- `POST /register`：注册
- `POST /logout`：退出登录
- `POST /refresh`：刷新令牌
- `GET /me`：获取当前用户
- `POST /change-password`：修改密码
- `POST /forgot-password`：生成重置验证码
- `POST /reset-password`：验证码重置密码
- `POST /admin-reset-password`：管理员重置用户密码

## 用户、角色、组织

### 用户 ` /api/users`

- `GET /`：分页查询用户
- `GET /:id`：用户详情
- `POST /`：创建用户
- `PUT /:id`：更新用户
- `DELETE /:id`：删除用户
- `POST /:id/roles`：分配角色
- `POST /roles/batch`：批量分配角色
- `PATCH /:id/status`：修改状态

#### 数据权限相关

- `GET|PUT /:id/company-scopes`：公司范围权限
- `GET|PUT /:id/repository-scopes`：仓库范围权限
- `GET|PUT /:id/physical-archive-scopes`：实体档案范围权限
- `GET|PUT /:id/archive-scopes`：档案公司范围
- `GET|PUT /:id/document-review-scopes`：文档审查公司范围

### 角色 ` /api/roles`

- `GET /`：角色列表
- `GET /permissions`：权限列表
- `GET /permissions/modules`：权限模块列表
- `GET /:id`：角色详情
- `POST /`：创建角色
- `PUT /:id`：更新角色
- `DELETE /:id`：删除角色
- `GET /:id/users`：角色用户
- `PUT /:id/users`：配置角色用户
- `GET|PUT /:id/repositories`：角色仓库权限
- `GET|PUT /:id/archives`：角色档案权限

### 部门 ` /api/departments`

- `GET /tree`：组织树
- `POST /`：创建部门
- `PUT /:id`：更新部门
- `DELETE /:id`：删除部门
- `PATCH /reorder`：调整组织结构

## 仓库与电子文档

### 仓库 ` /api/repositories`

- `GET /`：分页查询仓库
- `GET /accessible`：当前用户可访问仓库
- `GET /:id`：仓库详情
- `POST /`：创建仓库
- `PUT /:id`：更新仓库
- `DELETE /:id`：删除仓库
- `POST /:id/permissions`：设置仓库权限

### 文档 ` /api/documents`

主要能力：

- 仓库目录浏览
- 单文件/多文件上传
- 文档详情
- 下载、预览、版本管理
- 创建文件夹、重命名、移动、删除
- OnlyOffice 在线编辑与回调保存

关键接口：

- `GET /repo/:repoId`：目录分页
- `GET /:id`：文档详情
- `POST /repo/:repoId/upload`：单文件上传
- `POST /repo/:repoId/upload-multiple`：批量上传
- `POST /repo/:repoId/folders`：创建文件夹
- `POST /move`：移动文件
- `POST /rename`：重命名
- `GET /:id/download`：下载
- `GET /:id/preview`：预览
- `GET /:id/versions`：版本列表
- `POST /:id/versions/:versionId/restore`：版本恢复
- `DELETE /:id`：删除
- `GET /:id/onlyoffice/config`：OnlyOffice 配置
- `GET /:id/onlyoffice/file`：OnlyOffice 文件读取
- `POST /:id/onlyoffice/callback`：OnlyOffice 保存回调

## 分享与搜索

### 分享 ` /api/shares`

公共访问接口：

- `GET /access/:code`
- `POST /access/:code`
- `GET /access/:code/download`

用户侧管理接口：

- `GET /`：我的分享列表
- `GET /:id`：分享详情
- `POST /document/:documentId`：创建分享
- `POST /:id/disable`：禁用分享
- `DELETE /:id`：删除分享

### 搜索 ` /api/search`

- `GET /`：全文检索或降级简单检索
- `POST /reindex/:repositoryId`：重建仓库索引

## 实体档案与借阅

### 实体档案 ` /api/physical-archives`

主要能力：

- 分页查询、详情、增删改
- 直接借阅与归还
- 借阅记录查询
- 审核提交、归档、驳回、修改、销毁
- 档案附件上传、列表、删除

关键接口：

- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/borrow`
- `POST /:id/return`
- `GET /:id/borrow-records`
- `POST /:id/actions/submit-review`
- `POST /:id/actions/approve-archive`
- `POST /:id/actions/reject-review`
- `POST /:id/actions/mark-modified`
- `POST /:id/actions/destroy`
- `GET /:id/attachments`
- `POST /:id/attachments`
- `DELETE /attachments/:attachmentId`

### 档案分类 ` /api/archive-categories`

- `GET /`：列表或树形结构
- `GET /:id`：详情
- `POST /`：创建分类
- `PUT /:id`：更新分类
- `DELETE /:id`：删除分类

### 借阅申请 ` /api/borrow-requests`

- `POST /`：提交借阅申请
- `GET /`：借阅申请列表
- `GET /my-pending`：我的待审批
- `GET /my-applications`：我的申请
- `GET /:id`：申请详情
- `POST /:id/approve`：审批通过
- `POST /:id/reject`：审批驳回
- `POST /:id/cancel`：取消申请

### 统一借阅 ` /api/unified-borrow`

- `POST /:id/borrow-unified`：按系统模式自动处理直接借阅或审批申请
- `POST /:id/return-unified`：统一归还
- `GET /borrow-mode`：获取当前借阅模式
- `GET /borrowed-archives`：借阅中档案列表

### 借阅工作流 ` /api/borrow-workflows`

用途：实体档案借阅审批流配置。

主要接口：

- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

## 审批待办与审计

### 审批待办 ` /api/approval-todos`

- `GET /`：我的待办列表
- `GET /unread-count`：未读数量
- `PUT /:id/read`：标记已读
- `PUT /read-all`：全部已读
- `POST /upload-signature`：上传签名图片
- `POST /push`：批量推送待办

### 审计日志 ` /api/audit-logs`

- `GET /`：分页查询审计日志

## 文档审查

### 审查单 ` /api/document-reviews`

主要能力：

- 审查单列表、详情、创建、编辑、删除
- 待我审批列表
- AI 审查触发与结果读取
- 审查附件上传、下载、删除
- 审批动作与流程流转
- OnlyOffice 只读预览

关键接口：

- `GET /`
- `GET /pending-approvals`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/ai-review`
- `GET /:id/ai-review-result`
- `POST /:id/attachments`
- `GET /:id/attachments/:attachmentId/download`
- `DELETE /:id/attachments/:attachmentId`
- `POST /:id/submit`
- `POST /:id/approve`
- `POST /:id/reject`
- `POST /:id/cancel`
- `GET /:id/attachments/:attachmentId/onlyoffice/config`
- `GET /:id/attachments/:attachmentId/onlyoffice/file`

### 审查工作流 ` /api/review-workflows`

- `GET /default`
- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`
- `PATCH /:id/toggle`
- `PATCH /:id/set-default`

### 人工标注 ` /api/annotations`

- `POST /`：创建标注
- `GET /`：按审查单查询标注
- `GET /stats`：标注统计
- `GET /:id`：标注详情
- `PUT /:id`：更新标注
- `DELETE /:id`：删除标注
- `PATCH /:id/resolve`：标记已解决
- `PATCH /:id/ignore`：忽略
- `PATCH /:id/reactivate`：重新激活
- `POST /:id/comments`：添加评论
- `DELETE /comments/:commentId`：删除评论

## 系统配置与统计

### 系统配置 ` /api/system-config`

公共接口：

- `GET /public`：公开站点设置

管理接口：

- `GET|PUT /theme`：主题配置
- `GET|PUT /settings`：站点设置
- `GET|PUT /ai`：AI 配置
- `POST /ai/test`：测试 AI 连通性

### 统计 ` /api/statistics`

- `GET /archives`：实体档案统计
- `GET /documents`：电子文档统计
- `GET /borrows`：借阅统计

## 补充说明

- 请求参数校验集中定义在 `server/src/routes/schemas.ts`
- 业务实现主要位于 `server/src/services/`
- 数据结构以 `server/prisma/schema.prisma` 为准
- 若后续需要 Swagger/OpenAPI，可在当前手写文档基础上继续补充自动化生成
