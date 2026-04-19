# mobile-server API 文档

基于当前代码实现整理（`mobile-server/src/ApiServer.php`）。

## 1. 服务地址

`mobile-server` 默认 API 基础路径：`/mobile-api`（可由 `MOBILE_API_BASE_PATH` 修改）。

常见启动方式对应地址：

- Docker 快速脚本 `start.sh`：`http://localhost:8081/mobile-api`
- Dockerfile 默认启动：`http://localhost:8080/mobile-api`
- 上传即用（如 Nginx/Apache）：`http://<host>/mobile-server/public/index.php/mobile-api`

## 2. 鉴权与请求规范

## 2.1 鉴权

除健康检查外，所有业务接口都要求请求头：

```http
X-Mobile-Api-Key: <MOBILE_API_KEY>
```

默认值（开发）：`dev_mobile_api_key`。

## 2.2 Content-Type

- `GET`：无需请求体
- `POST /feedback/tickets`：`Content-Type: application/json`

## 2.3 通用响应格式

该服务没有统一 `success` 字段，按接口返回业务对象。

- 正常：返回 JSON 对象（如 `{ items, page, pageSize, total }` 或 `{ data: ... }`）
- 错误：

```json
{
  "message": "Error message"
}
```

## 2.4 HTTP 状态码

- `200`：成功
- `201`：创建成功
- `204`：`OPTIONS` 预检
- `400`：参数错误 / 请求体错误
- `401`：未授权（API Key 错误或缺失）
- `404`：资源不存在
- `500`：服务内部错误

## 3. 接口总览

| 方法 | 路径 | 鉴权 |
| --- | --- | --- |
| GET | `/mobile-api/health` | 否 |
| GET | `/mobile-api/announcements` | 是 |
| GET | `/mobile-api/app-versions/check` | 是 |
| GET | `/mobile-api/help/categories` | 是 |
| GET | `/mobile-api/help/articles` | 是 |
| GET | `/mobile-api/help/articles/{id}` | 是 |
| POST | `/mobile-api/feedback/tickets` | 是 |
| GET | `/mobile-api/feedback/tickets` | 是 |
| GET | `/mobile-api/feedback/tickets/{ticketNo}` | 是 |

## 4. 详细接口

## 4.1 健康检查

- 方法：`GET`
- 路径：`/mobile-api/health`
- 鉴权：否

响应示例：

```json
{
  "ok": true,
  "service": "mobile-server"
}
```

## 4.2 公告列表

- 方法：`GET`
- 路径：`/mobile-api/announcements`
- 鉴权：是

Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 最小 1 |
| pageSize | number | 否 | 20 | 范围 1~100 |

响应示例：

```json
{
  "items": [
    {
      "id": 1,
      "title": "欢迎使用",
      "content": "感谢使用本服务！",
      "isActive": 1,
      "priority": 100,
      "startsAt": null,
      "endsAt": null,
      "createdAt": "2026-02-21 10:00:00"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

过滤规则：仅返回 `is_active=1` 且在有效期内（`starts_at/ends_at`）的公告，按 `priority desc, created_at desc` 排序。

## 4.3 版本检查

- 方法：`GET`
- 路径：`/mobile-api/app-versions/check`
- 鉴权：是

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| platform | string | 是 | 仅支持 `android` / `ios` |
| buildNumber | number | 否 | 当前安装 build，默认 0，范围 0~2147483647 |

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| hasUpdate | boolean | 是否有更新 |
| forceUpdate | boolean | 是否强制更新 |
| latestVersion | string/null | 最新版本号（无更新时为 null） |
| downloadUrl | string/null | 下载地址（无更新时为 null） |
| releaseNotes | string | 更新说明 |

响应示例：

```json
{
  "hasUpdate": true,
  "forceUpdate": false,
  "latestVersion": "1.2.0",
  "downloadUrl": "https://example.com/app.apk",
  "releaseNotes": "修复已知问题"
}
```

判定逻辑：

- 仅查询该平台 `status='PUBLISHED'` 的最高 `build_number`
- `latestBuild > buildNumber` => `hasUpdate=true`
- `forceUpdate=true` 当且仅当：
  - 已配置强更 `force_update=1`，或
  - `buildNumber < min_supported_build`

## 4.4 帮助分类列表

- 方法：`GET`
- 路径：`/mobile-api/help/categories`
- 鉴权：是

响应示例：

```json
{
  "data": [
    {
      "id": 1,
      "name": "常见问题",
      "sortOrder": 1,
      "isActive": 1
    }
  ]
}
```

仅返回 `is_active=1` 的分类，按 `sort_order asc, id asc` 排序。

## 4.5 帮助文章分页

- 方法：`GET`
- 路径：`/mobile-api/help/articles`
- 鉴权：是

Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 最小 1 |
| pageSize | number | 否 | 20 | 范围 1~100 |
| categoryId | number | 否 | - | 最小 1 |
| keyword | string | 否 | - | 按标题/关键词/content_md 模糊搜索 |

响应示例：

```json
{
  "items": [
    {
      "id": 1,
      "categoryId": 1,
      "title": "如何注册账号？",
      "contentMd": "# 注册步骤...",
      "keywords": "注册,账号",
      "viewCount": 10,
      "isActive": 1,
      "sortOrder": 1,
      "createdAt": "2026-02-21 10:00:00",
      "updatedAt": "2026-02-21 10:00:00"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

仅返回 `is_active=1` 的文章，按 `sort_order asc, id desc` 排序。

## 4.6 帮助文章详情

- 方法：`GET`
- 路径：`/mobile-api/help/articles/{id}`
- 鉴权：是

Path 参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 文章 ID（正整数） |

响应示例：

```json
{
  "data": {
    "id": 1,
    "categoryId": 1,
    "title": "如何注册账号？",
    "contentMd": "# 注册步骤...",
    "keywords": "注册,账号",
    "viewCount": 11,
    "isActive": 1,
    "sortOrder": 1,
    "createdAt": "2026-02-21 10:00:00",
    "updatedAt": "2026-02-21 10:05:00"
  }
}
```

说明：调用详情接口会自动 `view_count + 1`，并更新 `updated_at`。

## 4.7 提交反馈工单

- 方法：`POST`
- 路径：`/mobile-api/feedback/tickets`
- 鉴权：是
- Content-Type：`application/json`

Body 参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 是 | 工单类型，如 `bug`/`suggestion` |
| title | string | 是 | 工单标题 |
| content | string | 是 | 工单内容 |
| sourcePlatform | string | 是 | 来源平台，建议 `android`/`ios` |
| userId | string | 否 | 用户标识 |
| userName | string | 否 | 用户名 |
| contact | string | 否 | 联系方式 |
| appVersion | string | 否 | 应用版本 |
| deviceInfo | string | 否 | 设备信息 |

成功响应（201）：

```json
{
  "data": {
    "id": 12,
    "ticketNo": "FB20260221123000123",
    "userId": "u1001",
    "userName": "Alice",
    "contact": "alice@example.com",
    "type": "bug",
    "title": "上传失败",
    "content": "Android 14 下上传进度停在 90%",
    "status": "OPEN",
    "sourcePlatform": "android",
    "appVersion": "1.0.0",
    "deviceInfo": "Pixel 8",
    "createdAt": "2026-02-21 12:30:00",
    "updatedAt": "2026-02-21 12:30:00"
  }
}
```

## 4.8 反馈工单分页

- 方法：`GET`
- 路径：`/mobile-api/feedback/tickets`
- 鉴权：是

Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 最小 1 |
| pageSize | number | 否 | 20 | 范围 1~100 |
| userId | string | 否 | - | 仅查询某用户工单 |

响应示例：

```json
{
  "items": [
    {
      "id": 12,
      "ticketNo": "FB20260221123000123",
      "userId": "u1001",
      "userName": "Alice",
      "contact": "alice@example.com",
      "type": "bug",
      "title": "上传失败",
      "content": "Android 14 下上传进度停在 90%",
      "status": "OPEN",
      "sourcePlatform": "android",
      "appVersion": "1.0.0",
      "deviceInfo": "Pixel 8",
      "createdAt": "2026-02-21 12:30:00",
      "updatedAt": "2026-02-21 12:30:00"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

## 4.9 反馈工单详情

- 方法：`GET`
- 路径：`/mobile-api/feedback/tickets/{ticketNo}`
- 鉴权：是

Path 参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| ticketNo | string | 工单号（形如 `FBYYYYMMDDHHMMSSxxx`） |

响应示例：

```json
{
  "data": {
    "id": 12,
    "ticketNo": "FB20260221123000123",
    "userId": "u1001",
    "userName": "Alice",
    "contact": "alice@example.com",
    "type": "bug",
    "title": "上传失败",
    "content": "Android 14 下上传进度停在 90%",
    "status": "OPEN",
    "sourcePlatform": "android",
    "appVersion": "1.0.0",
    "deviceInfo": "Pixel 8",
    "createdAt": "2026-02-21 12:30:00",
    "updatedAt": "2026-02-21 12:30:00"
  }
}
```

## 5. 错误示例

## 5.1 API Key 缺失/错误

HTTP 401

```json
{
  "message": "Unauthorized"
}
```

## 5.2 参数不合法

HTTP 400

```json
{
  "message": "Invalid query parameter: page"
}
```

或：

```json
{
  "message": "Invalid platform. Allowed values: android, ios"
}
```

## 5.3 请求体错误

HTTP 400

```json
{
  "message": "Request body is required"
}
```

```json
{
  "message": "Invalid JSON body"
}
```

```json
{
  "message": "Missing required field: title"
}
```

## 6. cURL 示例（Docker:8081）

## 6.1 公告列表

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://localhost:8081/mobile-api/announcements?page=1&pageSize=20'
```

## 6.2 版本检查

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://localhost:8081/mobile-api/app-versions/check?platform=android&buildNumber=100'
```

## 6.3 帮助文章搜索

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://localhost:8081/mobile-api/help/articles?page=1&pageSize=20&keyword=更新'
```

## 6.4 提交反馈

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://localhost:8081/mobile-api/feedback/tickets' \
  -d '{
    "userId": "u1001",
    "userName": "Alice",
    "contact": "alice@example.com",
    "type": "bug",
    "title": "上传失败",
    "content": "Android 14 下上传进度停在 90%",
    "sourcePlatform": "android",
    "appVersion": "1.0.0",
    "deviceInfo": "Pixel 8"
  }'
```

## 7. 管理后台（非移动 API）

以下为 Web 管理页，不是 JSON REST API：

- 入口：`/public/admin.php`
- 默认密码：`admin123`（需立即修改）
- 模块：公告、版本、帮助分类、帮助文章、反馈工单

后台页面通过 HTML Form 的 `POST` 提交（如 `action=create/update/delete`），用于内容维护，不建议移动端直接调用。

## 8. 代码来源

- 路由与处理：`mobile-server/src/ApiServer.php`
- 环境变量：`mobile-server/src/Config.php`
- 响应封装：`mobile-server/src/JsonResponse.php`
- 数据结构：`mobile-server/src/Database/migrations/001_init.sql`

