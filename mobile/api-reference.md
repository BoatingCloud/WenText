# 文雨后端 API 文档（server）

本文档基于当前代码实现整理，覆盖 `server/src/routes/index.ts` 挂载的全部接口。

## 1. 基础信息

- 服务前缀：`/api`
- 数据格式：`application/json`（文件上传接口使用 `multipart/form-data`）
- 鉴权方式：`Authorization: Bearer <accessToken>`
- 限流：`/api/*` 启用全局限流，超限返回：

```json
{
  "success": false,
  "message": "请求过于频繁，请稍后再试",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

## 2. API 调用规范

- 基础地址：`http://<host>:<port>/api`。
- 鉴权接口统一使用 Header：`Authorization: Bearer <accessToken>`。
- JSON 接口使用 `Content-Type: application/json`；上传接口使用 `multipart/form-data`。
- 下文每个 API 都给出“调用方式”和“回复格式”；除二进制流与 OnlyOffice 回调外，默认回复为 JSON。
- 常见错误码：`VALIDATION_ERROR`(400)、`AUTHENTICATION_ERROR`(401)、`AUTHORIZATION_ERROR`(403)、`NOT_FOUND`(404)、`CONFLICT`(409)、`RATE_LIMIT_EXCEEDED`(429)、`INTERNAL_ERROR`(500)。

## 3. 鉴权与权限模型

- `authenticate`：要求登录。
- `optionalAuth`：可匿名访问。
- `requirePermission(...codes)`：**任一权限命中即可**（OR 逻辑）。
- 未登录、权限不足、参数校验失败分别返回 401/403/400。

## 4. 接口清单

## 4.1 健康检查

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | 否 | 无 | `GET /api/health` | `JSON`：`{ "success": true, "data": <{ status, timestamp, uptime }>, "message": "可选" }` |

## 4.2 认证（`/api/auth`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | 否 | 无 | `POST /api/auth/login`；Body: `username`, `password` | `JSON`：`{ "success": true, "data": <登录结果（含令牌与用户信息）>, "message": "可选" }` |
| POST | `/api/auth/register` | 否 | 无 | `POST /api/auth/register`；Body: `username,email,password,name,phone?,departmentId?` | `JSON`：`{ "success": true, "data": <新建用户>, "message": "可选" }` |
| POST | `/api/auth/logout` | 是 | 无 | `POST /api/auth/logout` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| POST | `/api/auth/refresh` | 否 | 无 | `POST /api/auth/refresh`；Body: `refreshToken` | `JSON`：`{ "success": true, "data": <新令牌>, "message": "可选" }` |
| POST | `/api/auth/change-password` | 是 | 无 | `POST /api/auth/change-password`；Body: `oldPassword,newPassword` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/auth/me` | 是 | 无 | `GET /api/auth/me` | `JSON`：`{ "success": true, "data": <当前登录用户>, "message": "可选" }` |

## 4.3 用户（`/api/users`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/users` | 是 | `user:view` | `GET /api/users`；Query: `page,pageSize,search?,departmentId?,status?,roleId?,organizationType?` | `JSON`：`{ "success": true, "data": <用户分页列表>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/users/:id` | 是 | `user:view` | `GET /api/users/:id`；Params: `id(uuid)` | `JSON`：`{ "success": true, "data": <用户详情>, "message": "可选" }` |
| POST | `/api/users` | 是 | `user:create` | `POST /api/users`；Body: `username,email,password,name,phone?,departmentId?,roleIds?` | `JSON`：`{ "success": true, "data": <新建用户>, "message": "可选" }` |
| PUT | `/api/users/:id` | 是 | `user:update` | `PUT /api/users/:id`；Params: `id`; Body: `email?,name?,phone?,avatar?,departmentId?,status?` | `JSON`：`{ "success": true, "data": <更新后用户>, "message": "可选" }` |
| DELETE | `/api/users/:id` | 是 | `user:delete` | `DELETE /api/users/:id`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| POST | `/api/users/:id/roles` | 是 | `user:update` | `POST /api/users/:id/roles`；Params: `id`; Body: `roleIds: uuid[]` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| POST | `/api/users/roles/batch` | 是 | `user:update` | `POST /api/users/roles/batch`；Body: `userIds: uuid[]`, `roleIds: uuid[]` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| PATCH | `/api/users/:id/status` | 是 | `user:update` | `PATCH /api/users/:id/status`；Params: `id`; Body: `status: ACTIVE|INACTIVE|LOCKED` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/users/:id/company-scopes` | 是 | 本人或 `user:view` | `GET /api/users/:id/company-scopes`；Params: `id` | `JSON`：`{ "success": true, "data": <用户公司范围>, "message": "可选" }` |
| PUT | `/api/users/:id/company-scopes` | 是 | `user:update` | `PUT /api/users/:id/company-scopes`；Params: `id`; Body: `companyCodes: string[]` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/users/:id/repository-scopes` | 是 | 本人或 `user:view` | `GET /api/users/:id/repository-scopes`；Params: `id` | `JSON`：`{ "success": true, "data": <用户仓库范围>, "message": "可选" }` |
| PUT | `/api/users/:id/repository-scopes` | 是 | `user:update` | `PUT /api/users/:id/repository-scopes`；Params: `id`; Body: `repositoryIds: uuid[]` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/users/:id/physical-archive-scopes` | 是 | 本人或 `user:view` | `GET /api/users/:id/physical-archive-scopes`；Params: `id` | `JSON`：`{ "success": true, "data": <用户实体档案范围>, "message": "可选" }` |
| PUT | `/api/users/:id/physical-archive-scopes` | 是 | `user:update` | `PUT /api/users/:id/physical-archive-scopes`；Params: `id`; Body: `physicalArchiveIds: uuid[]` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/users/:id/archive-scopes` | 是 | 本人或 `user:view` | `GET /api/users/:id/archive-scopes`；Params: `id` | `JSON`：`{ "success": true, "data": <用户档案公司范围>, "message": "可选" }` |
| PUT | `/api/users/:id/archive-scopes` | 是 | `user:update` | `PUT /api/users/:id/archive-scopes`；Params: `id`; Body: `companyCodes: string[]` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

## 4.4 角色与权限（`/api/roles`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/roles` | 是 | `role:view` | `GET /api/roles`；Query: `page,pageSize,search?` | `JSON`：`{ "success": true, "data": <角色分页列表>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/roles/permissions` | 是 | `role:view` | `GET /api/roles/permissions`；Query: `module?` | `JSON`：`{ "success": true, "data": <权限列表>, "message": "可选" }` |
| GET | `/api/roles/permissions/modules` | 是 | `role:view` | `GET /api/roles/permissions/modules` | `JSON`：`{ "success": true, "data": <权限模块列表>, "message": "可选" }` |
| GET | `/api/roles/:id` | 是 | `role:view` | `GET /api/roles/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <角色详情>, "message": "可选" }` |
| GET | `/api/roles/:id/users` | 是 | `role:view` 或 `user:view` | `GET /api/roles/:id/users`；Params: `id` | `JSON`：`{ "success": true, "data": <角色用户列表>, "message": "可选" }` |
| POST | `/api/roles` | 是 | `role:manage` | `POST /api/roles`；Body: `name,code,description?,permissionIds?` | `JSON`：`{ "success": true, "data": <新建角色>, "message": "可选" }` |
| PUT | `/api/roles/:id/users` | 是 | `role:manage` 或 `user:update` | `PUT /api/roles/:id/users`；Params: `id`; Body: `userIds: uuid[]` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| PUT | `/api/roles/:id` | 是 | `role:manage` | `PUT /api/roles/:id`；Params: `id`; Body: `name?,description?,permissionIds?` | `JSON`：`{ "success": true, "data": <更新后角色>, "message": "可选" }` |
| DELETE | `/api/roles/:id` | 是 | `role:manage` | `DELETE /api/roles/:id`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/roles/:id/repositories` | 是 | `role:view` 或 `repo:manage` | `GET /api/roles/:id/repositories`；Params: `id` | `JSON`：`{ "success": true, "data": <角色仓库权限明细>, "message": "可选" }` |
| PUT | `/api/roles/:id/repositories` | 是 | `role:manage` 或 `repo:manage` | `PUT /api/roles/:id/repositories`；Params: `id`; Body: `entries[]`（`repositoryId`,`permissions[]`,`dataScope?`,`scopePaths?`） | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/roles/:id/archives` | 是 | `role:view` 或 `archive:view` | `GET /api/roles/:id/archives`；Params: `id` | `JSON`：`{ "success": true, "data": <角色档案权限明细>, "message": "可选" }` |
| PUT | `/api/roles/:id/archives` | 是 | `role:manage` 或 `archive:manage` | `PUT /api/roles/:id/archives`；Params: `id`; Body: `entries[]`（`companyCode`,`permissions[]`） | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

## 4.5 部门（`/api/departments`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/departments/tree` | 是 | `user:view` | `GET /api/departments/tree` | `JSON`：`{ "success": true, "data": <部门树>, "message": "可选" }` |
| POST | `/api/departments` | 是 | `user:update` | `POST /api/departments`；Body: `name,code,description?,sortOrder?,parentId?,organizationType?` | `JSON`：`{ "success": true, "data": <新建部门>, "message": "可选" }` |
| PUT | `/api/departments/:id` | 是 | `user:update` | `PUT /api/departments/:id`；Params: `id`; Body: `name?,code?,description?,sortOrder?` | `JSON`：`{ "success": true, "data": <更新后部门>, "message": "可选" }` |
| DELETE | `/api/departments/:id` | 是 | `user:update` | `DELETE /api/departments/:id`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| PATCH | `/api/departments/reorder` | 是 | `user:update` | `PATCH /api/departments/reorder`；Body: `id,parentId,index` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

## 4.6 仓库（`/api/repositories`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/repositories` | 是 | `repo:view` | `GET /api/repositories`；Query: `page,pageSize,search?,storageType?,status?` | `JSON`：`{ "success": true, "data": <仓库分页列表>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/repositories/accessible` | 是 | 无 | `GET /api/repositories/accessible` | `JSON`：`{ "success": true, "data": <当前用户可访问仓库列表>, "message": "可选" }` |
| GET | `/api/repositories/:id` | 是 | `repo:view` | `GET /api/repositories/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <仓库详情>, "message": "可选" }` |
| POST | `/api/repositories` | 是 | `repo:create` | `POST /api/repositories`；Body: `name,code,description?,companyCode?,storageType,storagePath,storageConfig?,versionEnabled?,maxVersions?,encryptEnabled?,encryptAlgorithm?` | `JSON`：`{ "success": true, "data": <新建仓库>, "message": "可选" }` |
| PUT | `/api/repositories/:id` | 是 | `repo:manage` | `PUT /api/repositories/:id`；Params: `id`; Body: `name?,description?,companyCode?,storageConfig?,versionEnabled?,maxVersions?,encryptEnabled?,encryptAlgorithm?,status?` | `JSON`：`{ "success": true, "data": <更新后仓库>, "message": "可选" }` |
| DELETE | `/api/repositories/:id` | 是 | `repo:manage` | `DELETE /api/repositories/:id`；Params: `id`; Query: `permanent=true|false` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| POST | `/api/repositories/:id/permissions` | 是 | `repo:manage` | `POST /api/repositories/:id/permissions`；Params: `id`; Body: `permissions[]`（`targetType,targetId,permissions[],dataScope?,scopePaths?`） | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

## 4.7 文档（`/api/documents`）

说明：`preview/download/onlyoffice-file/share-download` 返回二进制流，不使用统一 JSON 包装。

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/documents/:id/onlyoffice/file` | OnlyOffice Token | 无 | `GET /api/documents/:id/onlyoffice/file`；Params: `id`; Query 或 Header 提供 OnlyOffice JWT | `Binary`（流式响应，非 JSON） |
| POST | `/api/documents/:id/onlyoffice/callback` | OnlyOffice Token | 无 | `POST /api/documents/:id/onlyoffice/callback`；Params: `id`; Body: `status:number,url?:string,...` | `JSON`：`{ "error": 0/1 }` |
| GET | `/api/documents/repo/:repoId` | 是 | `doc:view` | `GET /api/documents/repo/:repoId`；Query: `path?=/,page?=1,pageSize?=50` | `JSON`：`{ "success": true, "data": <目录分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/documents/:id` | 是 | `doc:view` | `GET /api/documents/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <文档详情>, "message": "可选" }` |
| POST | `/api/documents/repo/:repoId/upload` | 是 | `doc:upload` | `POST /api/documents/repo/:repoId/upload`；`multipart/form-data`：`file`,`parentPath?`,`commitMessage?` | `JSON`：`{ "success": true, "data": <新上传文档>, "message": "可选" }` |
| POST | `/api/documents/repo/:repoId/upload-multiple` | 是 | `doc:upload` | `POST /api/documents/repo/:repoId/upload-multiple`；`multipart/form-data`：`files[]`,`parentPath?` | `JSON`：`{ "success": true, "data": <批量上传结果>, "message": "可选" }` |
| POST | `/api/documents/repo/:repoId/folder` | 是 | `doc:upload` | `POST /api/documents/repo/:repoId/folder`；Body: `name,parentPath?` | `JSON`：`{ "success": true, "data": <新建文件夹>, "message": "可选" }` |
| GET | `/api/documents/:id/content` | 是 | `doc:view` | `GET /api/documents/:id/content`；Params: `id` | `JSON`：`{ "success": true, "data": <文本内容结果>, "message": "可选" }` |
| GET | `/api/documents/:id/onlyoffice/config` | 是 | `doc:view` | `GET /api/documents/:id/onlyoffice/config`；Params: `id` | `JSON`：`{ "success": true, "data": <OnlyOffice 配置（含 scriptUrl/config）>, "message": "可选" }` |
| PUT | `/api/documents/:id/content` | 是 | `doc:edit` | `PUT /api/documents/:id/content`；Params: `id`; Body: `content,commitMessage?` | `JSON`：`{ "success": true, "data": <更新后文档>, "message": "可选" }` |
| GET | `/api/documents/:id/preview` | 是 | `doc:view` | `GET /api/documents/:id/preview`；Params: `id` | `Binary`（流式响应，非 JSON） |
| GET | `/api/documents/:id/download` | 是 | `doc:view` | `GET /api/documents/:id/download`；Params: `id` | `Binary`（流式响应，非 JSON） |
| POST | `/api/documents/:id/move` | 是 | `doc:edit` | `POST /api/documents/:id/move`；Params: `id`; Body: `targetPath` | `JSON`：`{ "success": true, "data": <移动后文档>, "message": "可选" }` |
| POST | `/api/documents/:id/rename` | 是 | `doc:edit` | `POST /api/documents/:id/rename`；Params: `id`; Body: `name` | `JSON`：`{ "success": true, "data": <重命名后文档>, "message": "可选" }` |
| DELETE | `/api/documents/:id` | 是 | `doc:delete` | `DELETE /api/documents/:id`；Params: `id`; Query: `permanent=true|false` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/documents/:id/versions` | 是 | `doc:version` | `GET /api/documents/:id/versions`；Params: `id` | `JSON`：`{ "success": true, "data": <版本列表>, "message": "可选" }` |
| POST | `/api/documents/:id/versions/:versionId/restore` | 是 | `doc:version` | `POST /api/documents/:id/versions/:versionId/restore`；Params: `id,versionId` | `JSON`：`{ "success": true, "data": <恢复后的文档>, "message": "可选" }` |

## 4.8 实体档案（`/api/physical-archives`）

`createPhysicalArchiveSchema` / `updatePhysicalArchiveSchema` 字段较多，见第 5 节字段说明。

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/physical-archives` | 是 | `archive:view` | `GET /api/physical-archives`；Query: `page,pageSize,search?,categoryId?,status?,workflowStatus?,year?,includeDestroyed?,companyCode?` | `JSON`：`{ "success": true, "data": <实体档案分页列表>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/physical-archives/:id` | 是 | `archive:view` | `GET /api/physical-archives/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <实体档案详情>, "message": "可选" }` |
| POST | `/api/physical-archives` | 是 | `archive:create` | `POST /api/physical-archives`；Body: `createPhysicalArchiveSchema` | `JSON`：`{ "success": true, "data": <新建档案>, "message": "可选" }` |
| PUT | `/api/physical-archives/:id` | 是 | `archive:update` | `PUT /api/physical-archives/:id`；Params: `id`; Body: `updatePhysicalArchiveSchema` | `JSON`：`{ "success": true, "data": <更新后档案>, "message": "可选" }` |
| DELETE | `/api/physical-archives/:id` | 是 | `archive:delete` | `DELETE /api/physical-archives/:id`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| POST | `/api/physical-archives/:id/borrow` | 是 | `archive:borrow` | `POST /api/physical-archives/:id/borrow`；Params: `id`; Body: `borrower,borrowedAt?,dueAt?,borrowRemark?` | `JSON`：`{ "success": true, "data": <借阅后档案>, "message": "可选" }` |
| POST | `/api/physical-archives/:id/return` | 是 | `archive:return` | `POST /api/physical-archives/:id/return`；Params: `id`; Body: `returnedAt?,returnRemark?` | `JSON`：`{ "success": true, "data": <归还后档案>, "message": "可选" }` |
| GET | `/api/physical-archives/:id/borrow-records` | 是 | `archive:view` | `GET /api/physical-archives/:id/borrow-records`；Params: `id`; Query: `page,pageSize` | `JSON`：`{ "success": true, "data": <借阅记录分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| POST | `/api/physical-archives/:id/actions/submit-review` | 是 | `archive:update` | `POST /api/physical-archives/:id/actions/submit-review`；Params: `id`; Body: `comment?` | `JSON`：`{ "success": true, "data": <提审后档案>, "message": "可选" }` |
| POST | `/api/physical-archives/:id/actions/approve-archive` | 是 | `archive:approve` | `POST /api/physical-archives/:id/actions/approve-archive`；Params: `id`; Body: `reviewComment?` | `JSON`：`{ "success": true, "data": <审核通过后档案>, "message": "可选" }` |
| POST | `/api/physical-archives/:id/actions/reject-review` | 是 | `archive:approve` | `POST /api/physical-archives/:id/actions/reject-review`；Params: `id`; Body: `reviewComment` | `JSON`：`{ "success": true, "data": <驳回后档案>, "message": "可选" }` |
| POST | `/api/physical-archives/:id/actions/mark-modified` | 是 | `archive:update` | `POST /api/physical-archives/:id/actions/mark-modified`；Params: `id`; Body: `reason?` | `JSON`：`{ "success": true, "data": <标记修改后档案>, "message": "可选" }` |
| POST | `/api/physical-archives/:id/actions/destroy` | 是 | `archive:delete` | `POST /api/physical-archives/:id/actions/destroy`；Params: `id`; Body: `destroyReason` | `JSON`：`{ "success": true, "data": <销毁后档案>, "message": "可选" }` |
| GET | `/api/physical-archives/:id/attachments` | 是 | `archive:view` | `GET /api/physical-archives/:id/attachments`；Params: `id` | `JSON`：`{ "success": true, "data": <附件列表>, "message": "可选" }` |
| POST | `/api/physical-archives/:id/attachments` | 是 | `archive:update` | `POST /api/physical-archives/:id/attachments`；Params: `id`; `multipart/form-data`：`files[]` | `JSON`：`{ "success": true, "data": <上传后的附件列表>, "message": "可选" }` |
| DELETE | `/api/physical-archives/:id/attachments/:attachmentId` | 是 | `archive:update` | `DELETE /api/physical-archives/:id/attachments/:attachmentId`；Params: `id,attachmentId` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| GET | `/api/physical-archives/:id/attachments/:attachmentId/download` | 是 | `archive:view` | `GET /api/physical-archives/:id/attachments/:attachmentId/download`；Params: `id,attachmentId` | `Binary`（流式响应，非 JSON） |

## 4.9 分享（`/api/shares`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/shares/access/:code` | 可匿名 | 无 | `GET /api/shares/access/:code`；Query: `hasPassword?`,`password?` | `JSON`：`{ "success": true, "data": { "needPassword": true } }` 或完整分享数据 |
| POST | `/api/shares/access/:code` | 可匿名 | 无 | `POST /api/shares/access/:code`；Body: `password?` | `JSON`：`{ "success": true, "data": <分享访问结果>, "message": "可选" }` |
| GET | `/api/shares/access/:code/download` | 可匿名 | 无 | `GET /api/shares/access/:code/download`；Query: `password?` | `Binary`（流式响应，非 JSON） |
| GET | `/api/shares` | 是 | 无 | `GET /api/shares`；Query: `page,pageSize,documentId?,status?` | `JSON`：`{ "success": true, "data": <当前用户分享分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/shares/:id` | 是 | 无 | `GET /api/shares/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <分享详情>, "message": "可选" }` |
| POST | `/api/shares/document/:documentId` | 是 | 无 | `POST /api/shares/document/:documentId`；Params: `documentId`; Body: `shareType,password?,permissions?,expiresAt?,maxViews?` | `JSON`：`{ "success": true, "data": <新建分享>, "message": "可选" }` |
| POST | `/api/shares/:id/disable` | 是 | 无 | `POST /api/shares/:id/disable`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |
| DELETE | `/api/shares/:id` | 是 | 无 | `DELETE /api/shares/:id`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

## 4.10 搜索（`/api/search`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/search` | 是 | `search:basic` | `GET /api/search`；Query: `query(必填),repositoryId?,type?,extensions?,dateFrom?,dateTo?,page?,pageSize?` | `JSON`：`{ "success": true, "data": <文档分页结果>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| POST | `/api/search/reindex/:repositoryId` | 是 | `repo:manage` | `POST /api/search/reindex/:repositoryId`；Params: `repositoryId` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

说明：

- `pageSize` 最大 100。
- 用户拥有 `search:all` 时会绕过数据范围限制。
- 搜索优先 ES，0 结果或异常时回退 `simpleSearch`。

## 4.11 系统配置（`/api/system-config`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/system-config/public` | 否 | 无 | `GET /api/system-config/public` | `JSON`：`{ "success": true, "data": <公开站点配置>, "message": "可选" }` |
| GET | `/api/system-config/theme` | 是 | `system:manage` 或 `system:config` | `GET /api/system-config/theme` | `JSON`：`{ "success": true, "data": <主题配置>, "message": "可选" }` |
| PUT | `/api/system-config/theme` | 是 | `system:manage` 或 `system:config` | `PUT /api/system-config/theme`；Body: `themePreset,siteName?` | `JSON`：`{ "success": true, "data": <更新后主题配置>, "message": "可选" }` |
| GET | `/api/system-config/settings` | 是 | `system:manage` 或 `system:config` | `GET /api/system-config/settings` | `JSON`：`{ "success": true, "data": <系统设置>, "message": "可选" }` |
| PUT | `/api/system-config/settings` | 是 | `system:manage` 或 `system:config` | `PUT /api/system-config/settings`；Body: 站点设置（见第 5 节） | `JSON`：`{ "success": true, "data": <更新后系统设置>, "message": "可选" }` |

## 4.12 审计日志（`/api/audit-logs`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/audit-logs` | 是 | `audit:view` 或 `system:audit` | `GET /api/audit-logs`；Query: `page,pageSize,action?,module?,status?,userId?,dateFrom?,dateTo?` | `JSON`：`{ "success": true, "data": <审计日志分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |

## 4.13 档案分类（`/api/archive-categories`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/archive-categories` | 是 | `archive:view` | `GET /api/archive-categories`；Query: `tree=true|false` | `JSON`：`{ "success": true, "data": <分类列表或树>, "message": "可选" }` |
| GET | `/api/archive-categories/:id` | 是 | `archive:view` | `GET /api/archive-categories/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <分类详情>, "message": "可选" }` |
| POST | `/api/archive-categories` | 是 | `system:manage` | `POST /api/archive-categories`；Body: `name,code,parentId?,sortOrder?,description?,isEnabled?` | `JSON`：`{ "success": true, "data": <新建分类>, "message": "可选" }` |
| PUT | `/api/archive-categories/:id` | 是 | `system:manage` | `PUT /api/archive-categories/:id`；Params: `id`; Body: `name?,code?,sortOrder?,description?,isEnabled?` | `JSON`：`{ "success": true, "data": <更新后分类>, "message": "可选" }` |
| DELETE | `/api/archive-categories/:id` | 是 | `system:manage` | `DELETE /api/archive-categories/:id`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

## 4.14 借阅工作流（`/api/borrow-workflows`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/borrow-workflows` | 是 | `archive:view` | `GET /api/borrow-workflows` | `JSON`：`{ "success": true, "data": <工作流列表>, "message": "可选" }` |
| GET | `/api/borrow-workflows/:id` | 是 | `archive:view` | `GET /api/borrow-workflows/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <工作流详情>, "message": "可选" }` |
| POST | `/api/borrow-workflows` | 是 | `system:manage` | `POST /api/borrow-workflows`；Body: `name,description?,isDefault?,isEnabled?,nodes[]` | `JSON`：`{ "success": true, "data": <新建工作流>, "message": "可选" }` |
| PUT | `/api/borrow-workflows/:id` | 是 | `system:manage` | `PUT /api/borrow-workflows/:id`；Params: `id`; Body: `name?,description?,isDefault?,isEnabled?,nodes?` | `JSON`：`{ "success": true, "data": <更新后工作流>, "message": "可选" }` |
| DELETE | `/api/borrow-workflows/:id` | 是 | `system:manage` | `DELETE /api/borrow-workflows/:id`；Params: `id` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

`nodes[]` 字段：`name,nodeOrder,approverType(USER|ROLE|DEPARTMENT_HEAD),approverValue?,isRequired?`。

## 4.15 借阅申请（`/api/borrow-requests`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/borrow-requests` | 是 | `archive:borrow` | `POST /api/borrow-requests`；Body: `archiveId,workflowId?,borrowReason?,expectedBorrowAt?,expectedReturnAt?` | `JSON`：`{ "success": true, "data": <新建借阅申请>, "message": "可选" }` |
| GET | `/api/borrow-requests` | 是 | `archive:view` | `GET /api/borrow-requests`；Query: `page,pageSize,status?,archiveId?` | `JSON`：`{ "success": true, "data": <借阅申请分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/borrow-requests/my-pending` | 是 | 无 | `GET /api/borrow-requests/my-pending`；Query: `page,pageSize` | `JSON`：`{ "success": true, "data": <我的待审批分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/borrow-requests/my-applications` | 是 | 无 | `GET /api/borrow-requests/my-applications`；Query: `page,pageSize` | `JSON`：`{ "success": true, "data": <我的申请分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/borrow-requests/:id` | 是 | `archive:view` | `GET /api/borrow-requests/:id`；Params: `id` | `JSON`：`{ "success": true, "data": <借阅申请详情>, "message": "可选" }` |
| POST | `/api/borrow-requests/:id/approve` | 是 | `archive:approve` | `POST /api/borrow-requests/:id/approve`；Params: `id`; Body: `comment?,signatureUrl?` | `JSON`：`{ "success": true, "data": <审批后申请>, "message": "可选" }` |
| POST | `/api/borrow-requests/:id/reject` | 是 | `archive:approve` | `POST /api/borrow-requests/:id/reject`；Params: `id`; Body: `comment,signatureUrl?` | `JSON`：`{ "success": true, "data": <驳回后申请>, "message": "可选" }` |
| POST | `/api/borrow-requests/:id/cancel` | 是 | 无 | `POST /api/borrow-requests/:id/cancel`；Params: `id` | `JSON`：`{ "success": true, "data": <取消后申请>, "message": "可选" }` |

## 4.16 审批待办（`/api/approval-todos`）

| 方法 | 路径 | 鉴权 | 权限 | 调用方式 | 回复格式 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/approval-todos` | 是 | 无 | `GET /api/approval-todos`；Query: `page,pageSize,unreadOnly?` | `JSON`：`{ "success": true, "data": <我的待办分页>, "pagination": { "page": 1, "pageSize": 20, "total": n, "totalPages": n } }` |
| GET | `/api/approval-todos/unread-count` | 是 | 无 | `GET /api/approval-todos/unread-count` | `JSON`：`{ "success": true, "data": { "count": n } }` |
| PUT | `/api/approval-todos/:id/read` | 是 | 无 | `PUT /api/approval-todos/:id/read`；Params: `id` | `JSON`：`{ "success": true, "data": <标记后的待办>, "message": "可选" }` |
| PUT | `/api/approval-todos/read-all` | 是 | 无 | `PUT /api/approval-todos/read-all` | `JSON`：`{ "success": true, "data": null, "message": "..." }` |

## 5. 关键 Schema 说明

## 5.1 分页与 ID

- `paginationSchema`：`page` 默认 `1`，`pageSize` 默认 `20`。
- `idParamSchema`：`id` 必须是 UUID。

## 5.2 搜索

- `query`：必填，非空。
- `repositoryId`：可选 UUID。
- `type`：`file|folder|all`。
- `dateFrom/dateTo`：ISO datetime。
- `pageSize`：`1~100`。

## 5.3 系统设置（`updateSiteSettingsSchema`）

可更新字段：

- `siteName?`
- `siteDescription?`
- `groupName?`
- `themePreset?` (`cement-gray|sea-salt-blue|warm-sand|jade-ink`)
- `allowRegister?`
- `passwordMinLength?`（6~32）
- `uploadMaxSizeMB?`（10~2048）
- `defaultRepositoryBasePath?`
- `defaultRepositoryMaxVersions?`（1~1000）
- `companyCatalog?`（数组，最多 500）
- `fondsCatalog?`（数组，最多 200）
- `archiveBorrowMode?`（`direct|workflow`）

至少提交 1 个字段。

## 5.4 实体档案 Schema（摘要）

创建必填字段：

- `title`
- `archiveNo`
- `shelfLocation`

常用字段：

- 分类：`categoryName/categoryPath/categoryId`
- 全宗：`fondsName/fondsCode`
- 状态：`status(IN_STOCK|BORROWED|LOST|DESTROYED)`
- 工作流：`workflowStatus(DRAFT|PENDING_REVIEW|ARCHIVED|MODIFIED|BORROWED|RETURNED|DESTROYED)`
- 年度与日期：`year, filingDate, effectiveDate, invalidDate, ...`
- 数字化：`electronicFileId, originalFileName, fileExtension, fileSizeBytes, fileStoragePath, fileMd5, ocrText`
- 版本：`versionNo, revisionNo, versionStatus, isCurrentVersion, versionHistory`
- 安全：`accessLevel, accessPolicy, watermarkConfig, encryptionAlgorithm, encryptionStatus`
- 自定义：`customText1/2/3, customNumber, customDate, extraJson`

规则：

- 创建时若 `status=BORROWED`，必须传 `borrower`。
- 更新接口会先将 `null` 清洗为 `undefined`，并要求至少 1 个字段。

## 6. 文件上传与下载约定

- 文档上传字段名：`file`（单文件）或 `files`（多文件）。
- 实体档案附件上传字段名：`files`。
- 单文件大小限制由系统配置 `uploadMaxSizeMB` 控制，超限返回 400。
- 下载类接口返回二进制流，请前端按 blob/file 处理。

## 7. 代码来源（可追溯）

- 路由挂载：`server/src/routes/index.ts`
- 参数 Schema：`server/src/routes/schemas.ts`
- 鉴权与权限：`server/src/middleware/auth.ts`
- 参数校验：`server/src/middleware/validate.ts`
- 响应包装：`server/src/utils/response.ts`
